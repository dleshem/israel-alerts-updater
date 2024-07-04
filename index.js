import functions from '@google-cloud/functions-framework';

import fs from 'memfs';
import _ from 'lodash';
import { parse, stringify } from 'csv/sync';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node/index.js';

const GITHUB_ACCESS_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const PROXY_URL = process.env.PROXY_URL;
const author = {
    name: 'Danny Leshem',
    email: 'dleshem@gmail.com'
};

const israelAlertsCsvFilename = 'israel-alerts.csv';

const fetchAlerts = async ({fromDate = null, toDate = null}) => {
    let fromDateStr = '';
    if (fromDate) {
        const s = fromDate.toISOString();
        fromDateStr = s.substring(0, s.length - 5);
    }

    let toDateStr = '';
    if (toDate) {
        const s = toDate.toISOString();
        toDateStr = s.substring(0, s.length - 5);
    }
    
    const proxyAgent = new HttpsProxyAgent(PROXY_URL);
    const response = await fetch(`https://alerts-history.oref.org.il/Shared/Ajax/GetAlarmsHistory.aspx?lang=he&mode=0&fromDate=${fromDateStr}&toDate=${toDateStr}`, {
        agent: proxyAgent
    });
    return await response.json();
};

const run = async () => {
    // Fetch known alerts (israel-alerts-data git)
    console.log('Fetching known alerts');
    const israelAlertsDataGitDirectory = '/israel-alerts-data';
    if (fs.existsSync(israelAlertsDataGitDirectory)) {
        console.log('path exists, git pull');
        try {
            await git.pull({
                fs,
                http,
                dir: israelAlertsDataGitDirectory,
                author
            });
        } catch (e) {
            fs.rmSync(israelAlertsDataGitDirectory, { recursive: true, force: true }); 
            throw e;
        }

    } else {
        console.log('path does not exist, git clone');
        fs.mkdirSync(israelAlertsDataGitDirectory);
        await git.clone({
            fs,
            http,
            dir: israelAlertsDataGitDirectory,
            url: 'https://github.com/dleshem/israel-alerts-data',
            depth: 1
        });
    }

    const israelAlertsDataCsvPath = path.join(israelAlertsDataGitDirectory, israelAlertsCsvFilename);
    const knownAlertsCsv = fs.readFileSync(israelAlertsDataCsvPath);
    const knownAlerts = parse(knownAlertsCsv, {
        columns: true
    });
    console.log(`Known alerts: ${knownAlerts.length}`);

    // Fetch new alerts
    let fromDate = null;
    if (knownAlerts.length > 0) {
        const lastKnownAlert = knownAlerts[knownAlerts.length - 1];
        const dateParts = lastKnownAlert.date.split('\.');
        const timeParts = lastKnownAlert.time.split(':');
        const lastAlertDate = new Date(Date.parse(
            `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timeParts[0]}:${timeParts[1]}:${timeParts[2]}Z`));
            console.log(`Last alert timestamp: ${lastAlertDate.toISOString()}`);

        fromDate = new Date(lastAlertDate.getTime() + 1000);
    }

    const latestAlerts = await fetchAlerts({ fromDate });
    console.log(`Latest alerts: ${latestAlerts.length}`);

    if (latestAlerts.length > 0) {
        // Merge
        const latestAlertsById = _.keyBy(latestAlerts, 'rid');
        const knownAlertsById = _.keyBy(knownAlerts, 'rid');
        const mergedAlertsById = _.merge(knownAlertsById, latestAlertsById);

        const mergedAlerts = _.sortBy(_.values(mergedAlertsById), alert => parseInt(alert.rid));
        console.log(`Merged alerts: ${mergedAlerts.length}`);

        const numNewAlerts = mergedAlerts.length - knownAlerts.length;
        console.log(`New alerts: ${numNewAlerts}`);

        if (numNewAlerts > 0) {
            // Update known alerts
            const mergedAlertsCsv = stringify(mergedAlerts, {
                header: true
            });

            fs.writeFileSync(israelAlertsDataCsvPath, mergedAlertsCsv);

            // Commit and push changes
            await git.add({
                fs,
                http,
                dir: israelAlertsDataGitDirectory,
                filepath: israelAlertsCsvFilename
            });

            await git.commit({
                fs,
                http,
                dir: israelAlertsDataGitDirectory,
                author,
                message: (numNewAlerts !== 1) ? `Added ${numNewAlerts} alerts` : 'Added 1 alert'
            });

            await git.push({
                fs,
                http,
                dir: israelAlertsDataGitDirectory,
                remote: 'origin',
                ref: 'main',
                onAuth: () => ({ username: GITHUB_ACCESS_TOKEN })
            });
        }
    }
}

functions.http('helloHttp', async (req, res) => {
    await run();
    res.send(`Hello ${req.query.name || req.body.name || 'World'}!`);
});

await run();
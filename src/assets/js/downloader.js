// HUGE THANKS TO DAMIEN FOR THIS CODE!
// https://damieng.com/blog/2017/03/10/downloading-files-with-progress-in-electron

const fs = require('fs');


export default async function download(sourceUrl, targetFile, progressCallback, length) {
    const request = new Request(sourceUrl, {
        headers: new Headers({ 'Content-Type': 'application/octet-stream' })
    });

    const response = await fetch(request);
    if (!response.ok) {
        throw Error(`Unable to download, server returned ${response.status} ${response.statusText}`);
    }

    const body = response.body;
    if (body == null) {
        throw Error('No response body');
    }

    const finalLength = length || parseInt(response.headers.get('Content-Length' || '0'), 10);
    const reader = body.getReader();
    const writer = fs.createWriteStream(targetFile);

    await streamWithProgress(finalLength, reader, writer, progressCallback);
    writer.close();
    writer.end();
}

async function streamWithProgress(length, reader, writer, progressCallback) {
    let bytesDone = 0;

    while (true) {
        const result = await reader.read();
        if (result.done) {
            if (progressCallback != null) {
                progressCallback(length, 100);
            }
            return;
        }

        const chunk = result.value;
        if (chunk == null) {
            throw Error('Empty chunk received during download');
        } else {
            writer.write(Buffer.from(chunk));
            if (progressCallback != null) {
                bytesDone += chunk.byteLength;
                const percent = length === 0 ? null : Math.floor(bytesDone / length * 100);
                progressCallback(bytesDone, percent);
            }
        }
    }
}
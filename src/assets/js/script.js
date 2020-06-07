const cmd = require('node-cmd')
const Swal = require('sweetalert2')
const Prom = require('bluebird')
const Axios = require('axios')
const fs = require('fs');
const path = require('path')
const { ipcRenderer } = require('electron')
const UserHome = require('os').homedir()
import download from './downloader.js'
import sleep from './sleep.js'
const getCmdAsync = Prom.promisify(cmd.get, { multiArgs: true, context: cmd })
const manifestArray = new Array();

// ON LOAD
$(document).ready((async function() {
    await checkRequiredToolsInstalled()

    // TEST FUNCTION
    for (var i = 1; i <= 10; i++) {
        // Clone the card and append it to the apps list
        var newCard = $('#cardApp' + i).clone()
        $(newCard).appendTo('#divAppsList')

        // Increment all of its id's by one
        $(newCard).attr('id', 'cardApp' + (i + 1))
        $(newCard).find('#appName' + i).attr('id', 'appName' + (i + 1))
        $(newCard).find('#appVersionAuthor' + i).attr('id', 'appVersionAuthor' + (i + 1))
        $(newCard).find('#appDescription' + i).attr('id', 'appDescription' + (i + 1))
        $(newCard).find('#learnApp' + i).attr('id', 'learnApp' + (i + 1))
        $(newCard).find('#installApp' + i).attr('id', 'installApp' + (i + 1))
    }
}));

// BOOTSTRAP VISUAL CALLS
$(document).ready((function() {
    AOS.init({
        disable: "mobile"
    })

    $("#carouselApps").carousel({
        interval: 5e3,
        cycle: !0
    })
}));

// MAIN FUNCTIONS

/**
 * Checks to see that git and WinGet are installed on a users machine. If not,
 * send them over to their respective functions to install it on a users 
 * computer with their permission.
 */
async function checkRequiredToolsInstalled() {
    // A check variable that can hold 4 different values
    // 0 - WinGet and git are installed
    // 1 - WinGet is installed, git is not installed
    // 2 - WinGet is not installed, git is installed
    // 3 - WinGet and git are not installed
    var installValue = 0

    await getCmdAsync('git').catch(err => {
        if (err.message.includes('\'git\' is not recognized')) {
            installValue = 1
        }
    })

    await getCmdAsync('winget').catch(err => {
        if (err.message.includes('\'wingetx\' is not recognized')) {
            if (installValue === 1) installValue = 3
            else installValue = 2
        }
    })

    // Alert the user if tools are not installed
    if (installValue != 0) {
        Swal.fire({
            icon: 'error',
            title: 'Some tools are missing',
            html: '<p>Don\'t worry! We could not find either git or WinGet installed on your system, and they are needed for ' +
                'wingetGUI to work. We can download and install what you need, however you might notice some new apps installed such as ' +
                'Git Bash, Git CMD and Git GUI</p><p>These tools are safe, but we just want to make sure you are okay with ' +
                'them being installed. If you are, click OK, otherwise click cancel.</p>',
            showCancelButton: true
        }).then(async(result) => {
            if (result.value) {
                if (installValue === 1) await installGit(false).then(() => { ipcRenderer.send('restartApp') })
                else if (installValue === 2) await installWinGet().then(() => { ipcRenderer.send('restartApp') })
                else if (installValue === 3) {
                    await installGit(true).then(() => { ipcRenderer.send('restartApp') })
                }
            }
        })
    } else {
        // Update the manifests
        cloneManifestRepository()
    }
}

function installGit(installWinGetAfter) {
    return new Promise(resolve => {
        Axios.get('https://api.github.com/repos/git-for-windows/git/releases/latest')
            .then(async(response) => {
                var dlink;

                // Get download link for git based on architecture
                if (process.arch.includes('ia32')) {
                    dlink = response.data.assets[0].browser_download_url
                } else if (process.arch.includes('x64')) {
                    dlink = response.data.assets[2].browser_download_url
                }

                // Download the file
                download(dlink, UserHome + '\\gitinstaller.exe', (bytes, percent) => $('#footerInfoText').text(`Downloading Git for Windows (${percent}%)`))
                    .then(async() => {
                        // Install git
                        $('#footerInfoText').text('Installing Git for Windows')
                        await sleep(2000)
                        getCmdAsync('"' + UserHome + '"\\gitinstaller.exe /SILENT').catch(err => {
                            if (err) {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Git for Windows did not install',
                                    text: 'The installer is located at ' + UserHome + '\\gitinstaller.exe'
                                })
                                console.log(err)
                            }
                        }).then(() => {
                            $('#footerInfoText').text('')
                            if (installWinGetAfter) installWinGet().then(() => { resolve(true) })
                        })
                    })
            })
    })
}

function installWinGet() {
    return new Promise(resolve => {
        Axios.get('https://api.github.com/repos/microsoft/winget-cli/releases/latest')
            .then(async(response) => {
                var dlink;

                // Get download link
                dlink = response.data.assets[0].browser_download_url

                // Download the file
                download(dlink, UserHome + '\\winget.appxbundle', (bytes, percent) => $('#footerInfoText').text(`Downloading WinGet (${percent}%)`))
                    .then(() => {
                        // Install WinGet
                        $('#footerInfoText').text('Installing WinGet')
                        getCmdAsync('powershell -command "Add-AppxPackage -Path \'' + UserHome + '"\\winget.appxbundle\'"').catch(err => {
                            if (err) {
                                Swal.fire({
                                    icon: 'error',
                                    title: 'WinGet did not install',
                                    text: 'The installer is located at ' + UserHome + '\\gitinstaller.exe'
                                })
                            }
                        }).then(() => {
                            $('#footerInfoText').text('')
                            resolve(true)
                        })
                    })
            })
    })
}

function cloneManifestRepository() {
    $('#footerInfoText').text('Grabbing most recent manifests for WinGet')

    // Check if the repository exists, and if not clone it into the user directory
    if (!fs.existsSync(UserHome + '\\wingetGUI\\winget-pkgs')) {
        getCmdAsync('git clone https://github.com/microsoft/winget-pkgs.git "' + UserHome + '\\wingetGUI\\winget-pkgs"').catch(err => {
            if (err) {
                console.log(err)
                Swal.fire({
                    icon: 'error',
                    title: 'Could not obtain manifests',
                    text: 'It seems like git has failed to download the most recent manifest files for WinGet. Do you want to try again?',
                    showCancelButton: true
                }).then((result) => {
                    if (result.value) {
                        // Rerun function to retry download
                        cloneManifestRepository()
                    }
                })
            }
        }).then(() => {
            $('#footerInfoText').text('')
            populateAppList()
        })
    } else {
        // Update the existing repository
        getCmdAsync('git fetch "' + UserHome + '\\wingetGUI\\winget-pkgs" --allow-unrelated-histories').catch(err => {
            if (err && !err.message.includes('CRLF')) {
                console.log(err)
                Swal.fire({
                    icon: 'error',
                    title: 'Could not obtain manifests',
                    text: 'It seems like git has failed to download the most recent manifest files for WinGet. Do you want to try again?',
                    showCancelButton: true
                }).then((result) => {
                    if (result.value) {
                        // Rerun function to retry download
                        cloneManifestRepository()
                    }
                })
            }
        }).then(() => {
            $('#footerInfoText').text('')
            populateAppList()
        })
    }
}

function populateAppList() {
    var dir = UserHome + '\\wingetGUI\\winget-pkgs\\manifests'
    traverseDir(dir)

    manifestArray.forEach(file, i => {
        fs.readFile(file, (err, data) => {
            if (err) throw err;
            let app = JSON.parse(data);

            //Add data to relevent card
            $('#appName' + i).text(app.Name)
            $('#appVersionAuthor' + i).text(app.Version + ' | ' + app.Author)
            $('#appDescription' + i).text(app.Description)
            $('#learnApp' + i).attr('href', app.Homepage)

            // Clone a new app card and add it to the list, relate it to the array number
            var newCard = $('#cardApp' + i).clone()
            $(newCard).appendTo('#divAppsList')

            // Increment all of its id's by one
            $(newCard).attr('id', 'cardApp' + (i + 1))
            $(newCard).find('#appName' + i).attr('id', 'appName' + (i + 1))
            $(newCard).find('#appVersionAuthor' + i).attr('id', 'appVersionAuthor' + (i + 1))
            $(newCard).find('#appDescription' + i).attr('id', 'appDescription' + (i + 1))
            $(newCard).find('#learnApp' + i).attr('id', 'learnApp' + (i + 1))
            $(newCard).find('#installApp' + i).attr('id', 'installApp' + (i + 1))
        });
    })
}

function traverseDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file)
        if (fs.lstatSync(fullPath).isDirectory()) {
            traverseDir(fullPath)
        } else {
            manifestArray.push(fullPath)
        }
    });
}
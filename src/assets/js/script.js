const cmd = require('node-cmd')
const Swal = require('sweetalert2')
const Prom = require('bluebird')
const Axios = require('axios')
const yaml = require('js-yaml')
const iconvlite = require('iconv-lite')
const fs = require('fs')
const fsp = require('fs').promises;
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

// BUTTON HANDLING
$(document).ready(() => {
    $('#searchButton').click(() => {
        // Spin the search icon to show it is searching
        $('#searchAppsPrepend > i').removeClass('pause-spinner')

        // For each card, search through and hide if it doesn't apply
        $('.card').each((index, card) => {
            if (!$(card).text().toLowerCase().includes($('#searchApps').val().toLowerCase())) $(card).hide()
            else $(card).show()
        })

        // Stop spinning when done
        $('#searchAppsPrepend > i').addClass('pause-spinner')
    })
})

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
        getCmdAsync('git fetch "' + UserHome + '\\wingetGUI\\winget-pkgs"').catch(err => {
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

    // Start adding the app cards
    addNewAppCard(0)
}

function addNewAppCard(index) {
    // For some reason these YAMLs have different encodings, so remove null characters if needed
    fsp.readFile(manifestArray[index], 'utf8').then(data => {
        $('#footerInfoText').text('Adding app ' + (index + 1) + ' of ' + manifestArray.length)
        data = data.replace(/\0/g, '')

        try {
            var app = yaml.safeLoad(data)

            //Add data to relevent card
            $('#appName' + index).text(app.Name)
            $('#appVersionAuthor' + index).text(app.Version + ' | ' + app.Publisher)
            $('#appDescription' + index).text(app.Description)
            $('#learnApp' + index).attr('href', app.Homepage)
            $('#appTags' + index).text(app.Tags)

            // Clone a new app card and add it to the list, relate it to the array number
            var newCard = $('#cardApp' + index).clone()
            $(newCard).appendTo('#divAppsList')

            // Increment all of its id's by one
            $(newCard).attr('id', 'cardApp' + (index + 1))
            $(newCard).find('#appName' + index).attr('id', 'appName' + (index + 1)).text('')
            $(newCard).find('#appVersionAuthor' + index).attr('id', 'appVersionAuthor' + (index + 1)).text('')
            $(newCard).find('#appDescription' + index).attr('id', 'appDescription' + (index + 1)).text('')
            $(newCard).find('#learnApp' + index).attr('id', 'learnApp' + (index + 1))
            $(newCard).find('#installApp' + index).attr('id', 'installApp' + (index + 1))
            $(newCard).find('#appTags' + index).attr('id', 'appTags' + (index + 1)).text('')
        } catch (e) {
            // That YAML just won't budge, so skip it. 
        }

        // Recurse if we can
        if (index + 1 < manifestArray.length) addNewAppCard(index + 1)
        else $('#footerInfoText').text('')
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
    })
}
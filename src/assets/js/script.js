const cmd = require('node-cmd')
const Swal = require('sweetalert2')
const Prom = require('bluebird')
const Axios = require('axios')
const yaml = require('js-yaml')
const compareVersions = require('compare-versions')
const fs = require('fs')
const fsp = require('fs').promises;
const path = require('path')
const { ipcRenderer } = require('electron')
const UserHome = require('os').homedir()
var child_process = require('child_process');
import download from './downloader.js'
import sleep from './sleep.js'
const getCmdAsync = Prom.promisify(cmd.get, { multiArgs: true, context: cmd })
const manifestArray = new Array();

var appCardCount = 1;

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
        // For each card, search through and hide if it doesn't apply
        $('.card').each((index, card) => {
            if (!$(card).text().toLowerCase().includes($('#searchApps').val().toLowerCase())) $(card).hide()
            else $(card).show()
        })
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

/**
 * Installs Git for Windows to a user's system if it isn't already installed
 * @param {boolean} installWinGetAfter 
 */
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

/**
 * Installs WinGet on a users system if it is not already installed
 */
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

/**
 * Uses Git to grab the most recent commit from Microsoft's package repository 
 */
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
        getCmdAsync('git -C "' + UserHome + '\\wingetGUI\\winget-pkgs" pull --allow-unrelated-histories').catch(err => {
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
    addNewApp(0)
}

/**
 * Adds a new app to the list of all apps.
 * @param {*} index 
 */
function addNewApp(index) {
    // For some reason these YAMLs have different encodings, so remove null characters if needed
    fsp.readFile(manifestArray[index], 'utf8').then(data => {
        $('#footerInfoText').text('Adding app ' + (index + 1) + ' of ' + manifestArray.length)
        data = data.replace(/\0/g, '')
        var app, path1, path2, currVer;

        try {
            app = yaml.safeLoad(data)
        } catch (e) {
            // Remove it from the array and reduce index back to that value
            manifestArray.splice(index, 1)
            index--

            // Recurse if we can
            if (index + 1 < manifestArray.length) addNewApp(index + 1)
            else $('#footerInfoText').text('')
        }

        // Fix for version numbers that get their .0's removed 
        // if (isFinite(app.Version) && !(app.Version.toString().includes('.'))) console.log(app.Version)

        if (index !== 0) {
            path1 = require('path').dirname(manifestArray[index])
            path2 = require('path').dirname(manifestArray[index - 1])
            currVer = $('#appVersionAuthor' + appCardCount).text().replace(/\|.*$/, '').trim()

            // Check if paths are not equal, or if one version doesn't meet semver standards. If not, just create a new app card
            if (path1 !== path2 || !compareVersions.validate(app.Version) || !compareVersions.validate(currVer)) {
                // Clone a new app card and add it to the list, relate it to the unique app count
                appCardCount++
                var newCard = $('#cardApp' + (appCardCount - 1)).clone(true, true)
                $(newCard).appendTo('#divAppsList')

                // Increment all of its id's by one
                $(newCard).attr('id', 'cardApp' + appCardCount)
                $(newCard).find('#appName' + (appCardCount - 1)).attr('id', 'appName' + (appCardCount)).text('')
                $(newCard).find('#appVersionAuthor' + (appCardCount - 1)).attr('id', 'appVersionAuthor' + (appCardCount)).text('')
                $(newCard).find('#appDescription' + (appCardCount - 1)).attr('id', 'appDescription' + (appCardCount)).text('')
                $(newCard).find('#learnApp' + (appCardCount - 1)).attr('id', 'learnApp' + (appCardCount))
                $(newCard).find('#appTags' + (appCardCount - 1)).attr('id', 'appTags' + (appCardCount)).text('')
                $(newCard).find('#installApp' + (appCardCount - 1)).attr('id', 'installApp' + (appCardCount))
                $(newCard).find('#appVersionHistory' + (appCardCount - 1)).attr('id', 'appVersionHistory' + (appCardCount)).text('').prop('disabled', true)
                $(newCard).find('#dropdownOlderVersions' + (appCardCount - 1)).attr('id', 'dropdownOlderVersions' + (appCardCount)).text('')
            } else {
                if (compareVersions.compare(currVer, app.Version, '<')) {
                    // Version is newer
                    $('#dropdownOlderVersions' + appCardCount).append(`<button class="dropdown-item dropdownOldVersion">${currVer}</button>`)
                    $('#appVersionHistory' + appCardCount).prop('disabled', false)
                } else if (path1 === path2 && compareVersions.compare(currVer, app.Version, '>')) {
                    // Version is older so skip changing card information
                    $('#dropdownOlderVersions' + appCardCount).append(`<button class="dropdown-item dropdownOldVersion">${app.Version}</button>`)
                    $('#appVersionHistory' + appCardCount).prop('disabled', false)

                    if (index + 1 < manifestArray.length) {
                        addNewApp(index + 1)
                        return;
                    } else $('#footerInfoText').text('')
                }
            }
        }

        //Add data to relevent card
        $('#appName' + appCardCount).text(app.Name)
        $('#appVersionAuthor' + appCardCount).text(app.Version + ' | ' + app.Publisher)
        $('#appDescription' + appCardCount).text(app.Description)
        $('#learnApp' + appCardCount).attr('href', app.Homepage)
        $('#appTags' + appCardCount).text(app.Tags)

        // Add event handler to recent install button (they get overwritten)
        document.getElementById(`installApp${appCardCount}`).addEventListener("click", function() { getAppInfoBeforeInstalling(true, this) })

        // Recurse if we can
        if (index + 1 < manifestArray.length) addNewApp(index + 1)
        else {
            $('#footerInfoText').text('')

            // Once all apps have been added, add listeners to old version buttons
            Array.from(document.getElementsByClassName(`dropdownOldVersion`)).forEach(function(element) {
                element.addEventListener('click', function() { getAppInfoBeforeInstalling(false, this) });
            });
        }
    })
}

/**
 * Traverses the manifests folder and adds all files to the manifest array
 * @param {*} dir 
 */
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

function getAppInfoBeforeInstalling(latestVer, e) {
    //Get the card app number, and grab atrributes needed for install
    var appNumber = $(e).closest('[id^="cardApp"').attr('id').replace('cardApp', '')
    var appName = $('#appName' + appNumber).text()
    var appVer

    if (latestVer) appVer = $('#appVersionAuthor' + appNumber).text().replace(/\|.*$/, '').trim()
    else appVer = $(e).text()

    runWinGetCommand(latestVer, appNumber, appName, appVer)
}

/**
 * Runs the WinGet command to install an app with it's name and version
 * @param {*} latestVer
 * @param {*} appNumber
 * @param {*} appName 
 * @param {*} appVer 
 */
function runWinGetCommand(latestVer, appNumber, appName, appVer) {
    var command

    if (latestVer) command = `winget install --name '${appName}' -e`
    else command = `winget install --name '${appName}' -e --version ${appVer}`

    // Set button to say downloading, and disable the button, then run the installer
    $('#installApp' + appNumber).html('<i class="fas fa-circle-notch fa-spin mr-1"></i>Downloading').prop('disabled', true)
    $('#appVersionHistory' + appNumber).prop('disabled', true)

    //Run the process
    var child = child_process.exec(`powershell -command "${command}"`)

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function(data) {
        if (data.includes('Installing')) $('#installApp' + appNumber).html('<i class="fas fa-circle-notch fa-spin mr-2"></i>Installing')
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function(data) {
        Swal.fire({
            icon: 'error',
            title: `${appName} install failed`,
            text: 'For some reason the installation failed. Please try again. It it keeps happening, report it as an issue on GitHub.'
        })
        $('#installApp' + appNumber).html('<i class="fas fa-download mr-2"></i>Install').prop('disabled', false)
        $('#appVersionHistory' + appNumber).prop('disabled', false)
    });

    child.on('close', function(code) {
        $('#installApp' + appNumber).html('<i class="fas fa-hdd mr-2"></i>Installed').removeClass('btn-light').addClass('btn-success')
    });
}
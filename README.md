# wingetGUI
### Install Windows apps using the Windows Package Manager without typing a single command.

## What is this useful for?
For ages I have wanted Windows to have its own package manager, and finally they have made one. The only catch, however, is that it is command line only. Therefore, I have set myself a mission to make a fully functioning GUI version of the Windows Package Manager.

## Current Features
- You can search for anything that you want (apps by name, developers and key words).
- Apps can be installed using Windows Package Manager.
- Old versions of apps within the community repo can also be installed if wanted.

## How does this work?
Every time the app is loaded, it will check that your system has a running version of Git and WinGet, the Windows Package Manager. Git is needed to grab the latest manifests from the community repo, and WinGet is needed to install the programs that you want. If either of these tools are not installed, wingetGUI will install them for you.

Manifests are pulled from the repository using Git, and is stored in your user folder under "wingetGUI". You are free to add your own manifest files to this folder, and wingetGUI should pick them up.

## Why is this currently so barebones?
I am developing this concurrently with the releases of WinGet. Therefore, all the features related to WinGet will be implemented into wingetGUI. At the moment, WinGet is still in preview and is being actively developed on, so I can only do so much with what is being given to us. As they add more features, wingetGUI will also get them.

## Planned features
- Adding app icons to each card if possible.
- Dark mode so wingetGUI doesn't blind people.
- Option for silent installs (dependent on the app being installed)
- Option for install location (dependent on the app being installed)
- Whatever WinGet's latest release has that this doesn't!

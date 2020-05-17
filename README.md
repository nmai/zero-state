# Zero State Chromium

Add links and notes to your New Tab page. Organize them as a single list, a tree, or multiple lists/trees.

Replaces the default New Tab page in Chromium browsers (Chrome + Edge 2020)

## Features:
- Ultralight - Vanilla JS + CSS, no third party libraries or bundles
- Synchronizes - if you are signed into Chrome on multiple devices, changes propagate instantly to all
- Unopinionated - you organize your stuff however you see fit. Doesn't try to force todo list format or a calendar view or agenda. It's just trees.
- Safe - there are lots of New Tab pages on the Chrome web store but almost all of them are collecting data, sliding referral links into your cookies. redirecting your searches through their proxies, and/or something else behind the scenes. If it's free and actively developed and cutely marketed and not open source you should really be suspicious. Ads and scams are pretty much the only available monetization path for chrome extensions so it's not really their fault 🙂

### Install:
- chrome://extensions
- Developer Mode: Enable
- Load unpacked... navigate to this folder... done.
- You can right click on menu item icon and Hide it, it's not necessary.

### How to use:
- First time you load a new page it will probably look like it didn't work, as it's completely empty. Look at the top right and see the button.
- Click the [+] icon to add a new node
- Type a name (Required), must be unique.
- URL not required, if none it will just be a black node, useful as a simple text note.
- Parent: not required, but if you want to add an item as a child of another node (i.e. add it to a folder), type the exact name of the target
  + Note: you can nest items infinitely but probably you will see glitches past the 2nd or 3rd level.
- To delete things, open the Add form again ([+] icon) and some sort of delete button will appear next to leaf nodes. Leafs are any items with no children. If you want to delete a folder delete the children first.
- To mark something as done without deleting it yet, you can right click on the node and it a strikethrough effect will be applied.

### Early screenshot
![screenshot](misc/screenshot2.png)




"inspiration" for design:
- https://codepen.io/mofies/pen/xJmpwZ
- https://codepen.io/Cweili/pen/EVoeKv

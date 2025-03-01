# Zero State - New Tab replacement for Chromium browsers

Add links and notes to your New Tab page. Organize them as a single list, a tree, or multiple lists/trees.

Replaces the default New Tab page in Chromium browsers (Chrome + Edge)

## Features:
- Ultralight - Vanilla JS + CSS, no third party libraries or bundles
- Synchronizes - if you are signed into Chrome on multiple devices, changes propagate instantly to all using the [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- Safe - respects your privacy. No trackers, no uploading data to 3rd party servers. Data sync is managed entirely by your browser.
- Unopinionated - you organize your stuff however you see fit. Doesn't try to force todo list format or a calendar view or agenda. It's just trees.

### How to use:
- First time you load a new page it will probably look like it didn't work, as it's completely empty. Look at the top right and see the button.
- Click the [+] icon to add a new node
- Type a name (Required), must be unique.
- URL not required, if none it will just be a black node, useful as a simple text note.
- Parent: not required, but if you want to add an item as a child of another node (i.e. add it to a folder), type the exact name of the target
- To delete things, open the Add form again ([+] icon) and some sort of delete button will appear next to leaf nodes. Leafs are any items with no children. If you want to delete a folder delete the children first.
- To mark something as done without deleting it yet, you can right click on the node and it a strikethrough effect will be applied.

### Early screenshot
![screenshot](misc/screenshot2.png)


Design inspiration:
- https://codepen.io/mofies/pen/xJmpwZ
- https://codepen.io/Cweili/pen/EVoeKv
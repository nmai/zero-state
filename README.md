# Land-O-Links

New Tab page for lazies with too many links (Chrome extension)

Created because all the "speed dial" extensions I could find on the Chrome webstore were either bloated (focused on background image and a million widgets more than bookmark functionality) or I straight up don't trust. Almost all ask for a bunch of permissions, including history, tabs, searches, and so on.

Features:
- Simple
- Safe (tried anyway)
- Beautiful (just kidding)
- Ultralight - Vanilla JS + CSS, no third party libraries or bundles
- Organic - Not even 1 preprocessor

Install:
- chrome://extensions
- Developer Mode: Enable
- Load unpacked... navigate to this folder... done.
- You can right click on menu item icon and Hide it, it's not necessary.

How to use:
- Click the [+] icon to add a new node
- Type a name (Required), must be unique.
- URL not required, if none it will just be a black node, useful as a folder
- Parent: not required, but if you want to add an item as a child of another node (i.e. add it to a folder), type the exact name of the target
  + Note: you can nest items infinitely. Just don't cry if there are some CSS glitches.. those will be worked out eventually when I learn CSS
- To delete things, open the Add form again ([+] icon) and some sort of delete button will appear next to leaf nodes. Leafs are any items with no children. If you want to delete a folder delete the children first.

It is my pleasure to introduce this lovely intuitive UX/UI to the world.

Early Screenshot:

![screenshot](screenshot1.png)


Contributing:
- Yes please

"inspiration" for design:
- https://codepen.io/mofies/pen/xJmpwZ
- https://codepen.io/Cweili/pen/EVoeKv
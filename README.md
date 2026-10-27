# Beauté of Anguar

Static website for Angaur State, Republic of Palau, served by GitHub Pages from the `main` branch (no build step).

Live site: https://barbaraquito-art.github.io/Beaute-of-Angaur-/
Editor: https://barbaraquito-art.github.io/Beaute-of-Angaur-/editor.html

## Pages

| File | Page |
|---|---|
| index.html | Home |
| discover.html | Discover |
| heritage.html | Heritage |
| sites.html | Sites |
| governance.html | Governance |
| gallery.html | Gallery (photos and videos) |
| contact.html | Contact |
| visit.html | Plan Your Visit |
| permit.html | Visitor permit application |
| permit-status.html | Application receipt, status and approved permit card |
| editor.html | Owner's editor (edit links, media library, publishing and permit status) |
| angaur-state.html | Old address, forwards to the home page |

Shared files: `styles.css` (design), `site.js` (menu, animations, filter, editor and publishing), `permit.js` and `permit-config.js` (permit form and status), `angaur-seal.jpg` (seal on the permit card), `permit-backend.gs` (Google Apps Script backend, kept here for reference).

## Editing and publishing

1. Open the editor and click **Edit** next to a page.
2. Click text to type. Click a photo to change, resize or remove it. Headers have **Change background photo**.
3. Click **Publish to website**. The first time, paste a fine-grained GitHub access key for this repository with **Contents: Read and write**. The key stays on that device only.
4. The editor commits the page to `main`, saves any uploaded photos in `images/uploads/`, and confirms when the live site shows the change.

## Visitor permits

Applications are stored privately in the State office's Google Sheet through `permit-backend.gs` (Google Apps Script web app). Submitting an application only creates a **pending receipt**. A permit card appears only after staff approve the row with **Angaur Permits → Approve selected application**, which assigns a permit number and emails the applicant.

Until the backend's web app address is placed in `permit-config.js`, the form tells visitors to contact the office instead of submitting.

## Photo credits

Sites, Governance and Plan Your Visit headers use public-domain photos from Wikimedia Commons (credited on each page). Other photos are the site owner's.

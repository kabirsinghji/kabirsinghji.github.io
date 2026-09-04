# escapades

Drop photos in this folder and they appear on the secret escapades page.
Nothing else to edit.

- JPG, PNG or WebP. Phones that shoot HEIC need to export as JPG first.
- The newest-looking filename shows first. Phone names like IMG_2041.jpg sort
  by themselves; otherwise start the name with the date, e.g. 2026-09-04-lund.jpg.
- Keep each photo under about 2 MB / 2000 px on the long side, or the page gets
  slow on phones.
- Anything that isn't an image (this file included) is ignored.

The page reads the folder listing through GitHub's public API. If that is ever
rate-limited, it falls back to an optional photos.json in this folder, which is
just a list of filenames: ["IMG_2041.jpg", "IMG_2040.jpg"]. You don't need to
create it unless the page starts saying it can't fetch the list.

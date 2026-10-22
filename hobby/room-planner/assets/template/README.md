# Room planner

See real furniture from local shops in a 3D copy of your room, at its real size, before you buy it.
Rearrange things, try new layouts, and keep every idea side by side.

```bash
npm install   # first time only
npm run dev   # then open http://localhost:5178
```

## How it works

There are two screens, switched at the top:

- **Explore**: your room in 3D with the top view beside it. Look around, drag things to move them, click one
  to turn, replace or remove it. **Layouts** at the bottom suggests new arrangements of your furniture.
- **Shop**: real products from local shops with real sizes, prices and photos. Pick one and press **Try it
  instead of your bed** (or sofa, lamp…), or **Add it as an extra**. The line at the bottom adds up the cost.

Trying a product or a layout never changes **My room now**: it happens in another version of the room, which
you can switch between, rename or delete from the menu at the top left. The gear button opens room size and
colours; the camera button saves a picture.

Found something somewhere else? **Shop → Add it from a photo**, or paste the shop link to Claude.

## Accuracy

The room's size was estimated from photos. Measure it and type the real numbers under the gear button; the
"fits / doesn't fit" checks are only as good as those numbers.

## Where things are saved

| File | What |
| --- | --- |
| `data/state.json` | Your room, every version and where everything stands. Saved automatically. |
| `data/shop.json` | The shop's products (built by `scripts/shop/build_shop.py`). |
| `data/catalog.json` | Things you added from photos ("My finds"). |
| `public/shop/`, `public/uploads/`, `public/items/` | Product photos and pictures. |

`http://localhost:5178/?showroom` shows every shop product together in one big room.

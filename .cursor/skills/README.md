# Project skills

`diagram-design` is **not** a Cursor marketplace plugin. Clone it once, then symlink it here so this project can use it without enabling it in every other Cursor chat.

```bash
git clone --depth 1 https://github.com/cathrynlavery/diagram-design.git ~/Developer/tools/diagram-design
ln -sfn ~/Developer/tools/diagram-design/skills/diagram-design .cursor/skills/diagram-design
```

The symlink is gitignored. Brand tokens live in `~/.diagram-design/profiles/stars-cellar.md`. This repo only stores `.diagram-design` (`profile: stars-cellar`).

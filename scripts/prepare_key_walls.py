"""Apply App-only key-wall art to the shared engine renderers."""
def prepare(web):
    def replace(file, old, new):
        path = web / file
        source = path.read_text()
        assert source.count(old) == 1, (file, old)
        path.write_text(source.replace(old, new))
    replace('js/inkball/app.js', '    this.wallImages = wallImages;', '''    this.keyWallImages = await Promise.all(sprites.key_walls.map((url) => this._loadImage(url)));
    this.wallImages = wallImages;''')
    replace('js/inkball/tiles.js', '''      const img = app.wallImages[this.group] || app.wallImages[0];
      if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);
      ctx.fillStyle = col;
      ctx.fillRect(p.x + 10, p.y + 10, 12, 12);''', '''      const img = app.keyWallImages?.[this.group] || app.keyWallImages?.[0];
      if (img) ctx.drawImage(img, p.x, p.y, Inkball.CELLSIZE, Inkball.CELLSIZE);''')
    replace('js/inkball/match-sync.js', '        wallImages: this.app.wallImages,', '        keyWallImages: this.app.keyWallImages,\n        wallImages: this.app.wallImages,')
    # The app-owned preview already loads key-wall sprites and uses these renderers.

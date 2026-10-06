# New_Level.md 导入地图

`New_Level.md` 是用户提供资源的原样副本，仅用于 App 构建。编译过程不修改布局、球序、总时间、发球间隔、限时墙编码或作者历史。

| 来源 | 中文名 | English | 进阶限时成就 | 大师限时成就 | 大师第三项成就 |
| --- | --- | --- | --- | --- | --- |
| Map1 | 色阶闸阵 | Spectrum Gates | 180 秒内通关 | 180 秒内通关 | 不超过 60 笔通关 |
| Map2 | 四色锁廊 | Chromatic Locks | 105 秒内通关 | 105 秒内通关 | 不超过 48 笔通关 |
| Map3 | 时隙交织 | Shifting Hours | 90 秒内通关 | 170 秒内通关 | 零误收通关 |
| Map4 | 单行迷宫 | One-Way Labyrinth | 105 秒内通关 | 180 秒内通关 | 不超过 48 笔通关 |
| Map5 | 分流急湾 | Cascade Junction | 105 秒内通关 | 145 秒内通关 | 零误收通关 |

每个难度的第一项成就都是通关；萌新只有该成就，进阶增加限时完成，大师再增加笔数或准确性要求。每项成就均要求成功通关；一次对局不必同时满足其他成就。

新地图使用 `spectrum-gates`、`chromatic-locks`、`shifting-hours`、`oneway-labyrinth`、`cascade-junction` 标识，与此前的五张 App 扩展地图成绩隔离。

`Tests/Fixtures/expansion-playthroughs.json` 保存了真实引擎的可重复结果。`guided: 1` 表示通过测试专用程序的合法绘线与擦除操作完成；`guided: 0` 表示该随机种子无需绘线即可完成。测试程序不会打包进应用。

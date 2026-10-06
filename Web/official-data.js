window.INKBALL_OFFICIAL={
  "version": 1,
  "maps": [
    {
      "id": "showcase",
      "name": "Showcase",
      "official": true,
      "author": "Spherail",
      "difficulties": {
        "easy": {
          "time": 30,
          "spawn_interval": 8,
          "score_increase_from_hole_capture_modifier": 1.0,
          "score_decrease_from_wrong_hole_modifier": 1.0,
          "balls": [],
          "achievements": [
            {
              "code": "showcase-easy-clear",
              "name": "Curtain Raiser",
              "name_zh": "好戏开场",
              "criterion": "clear",
              "display_order": 1
            }
          ],
          "layout": "showcase_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S                             X X \nX                               X X \nX                               X X \nX                               X X \nX                               X X \nX                               X X \nX                         H0    X X \nX                               X X \nX                               X X \nX                               X X \nX                               X X \nX         B2                    X X \nX                               X X \nX                           H2  X X \nX                               X X \nX                               X X \nX X X X X X X X X X X X X X X X X X "
        },
        "hard": {
          "time": 150,
          "spawn_interval": 6,
          "score_increase_from_hole_capture_modifier": 1.1,
          "score_decrease_from_wrong_hole_modifier": 1.1,
          "balls": [
            "blue",
            "orange",
            "grey",
            "blue",
            "green",
            "grey"
          ],
          "achievements": [
            {
              "code": "showcase-hard-perfect",
              "name": "Spotless Exhibit",
              "name_zh": "无瑕展品",
              "criterion": "no_wrong_captures",
              "display_order": 1
            },
            {
              "code": "showcase-hard-score",
              "name": "Center Stage",
              "name_zh": "C 位出道",
              "criterion": "score_at_least",
              "target": 900,
              "display_order": 2
            }
          ],
          "layout": "showcase_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S         K0      C2          X X \nX           K2        D         X X \nX   U                           X X \nX   R2                L         X X \nX                               X X \nX                               X X \nX                         H0    X X \nX                               X X \nX                               X X \nX                               X X \nX                 K0            X X \nX         B2                    X X \nX                               X X \nX                           H2  X X \nX                               X X \nX                               X X \nX X X X X X X X X X X X X X X X X X "
        },
        "master": {
          "time": 110,
          "spawn_interval": 4,
          "score_increase_from_hole_capture_modifier": 1.3,
          "score_decrease_from_wrong_hole_modifier": 1.3,
          "timed_tile_lifetime_seconds": 40,
          "balls": [
            "blue",
            "orange",
            "grey",
            "blue",
            "green",
            "grey",
            "yellow",
            "blue",
            "orange",
            "grey"
          ],
          "achievements": [
            {
              "code": "showcase-master-score",
              "name": "Museum Grade",
              "name_zh": "镇馆之作",
              "criterion": "score_at_least",
              "target": 1050,
              "display_order": 1
            },
            {
              "code": "showcase-master-perfect",
              "name": "Curator's Eye",
              "name_zh": "策展慧眼",
              "criterion": "no_wrong_captures",
              "display_order": 2
            },
            {
              "code": "showcase-master-lines",
              "name": "Four-Stroke Wonder",
              "name_zh": "四笔成画",
              "criterion": "max_lines_drawn",
              "target": 4,
              "display_order": 3
            }
          ],
          "layout": "showcase_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S         K0      C2    r     X X \nX           K2        D         X X \nX   U       T           d       X X \nX   R2                L         X X \nX         Y2    V2              X X \nX               G0              X X \nX                         H0    X X \nX                               X X \nX                               X X \nX           u                   X X \nX                 K0            X X \nX         B2                    X X \nX                               X X \nX                           H2  X X \nX                               X X \nX                               X X \nX X X X X X X X X X X X X X X X X X "
        }
      }
    },
    {
      "id": "hourglass",
      "name": "Hourglass",
      "official": true,
      "author": "Spherail",
      "difficulties": {
        "easy": {
          "time": 230,
          "spawn_interval": 8,
          "score_increase_from_hole_capture_modifier": 1.0,
          "score_decrease_from_wrong_hole_modifier": 1.0,
          "balls": [
            "grey",
            "blue"
          ],
          "achievements": [
            {
              "code": "hourglass-easy-clear",
              "name": "First Grain Falls",
              "name_zh": "第一粒沙",
              "criterion": "clear",
              "display_order": 1
            }
          ],
          "layout": "hourglass_easy.txt",
          "layout_content": "4 X X X X X X X X X X X X X X X X 4 \nX 4 X           H1            X 4 X \nX X 4 X                     X 4 X X \nX   X 4 X                 X 4 X   X \nX     X 4 X             X 4 X     X \nX       X 4 X         X 4 X       X \nX         X             X         X \nX     B1  S             S     H0  X \nX                                 X \nX                                 X \nX         S             S   B2    X \nX         X             X         X \nX       X 4 X         X 4 X       X \nX     X 4 X             X 4 X     X \nX   X 4 X                 X 4 X   X \nX X 4 X           H2        X 4 X X \nX 4 X                         X 4 X \n4 X X X X X X X X X X X X X X X X 4 "
        },
        "hard": {
          "time": 185,
          "spawn_interval": 6,
          "score_increase_from_hole_capture_modifier": 1.2,
          "score_decrease_from_wrong_hole_modifier": 1.1,
          "balls": [
            "green",
            "grey",
            "blue",
            "yellow",
            "orange",
            "grey"
          ],
          "achievements": [
            {
              "code": "hourglass-hard-perfect",
              "name": "No Grain Lost",
              "name_zh": "滴沙不漏",
              "criterion": "no_wrong_captures",
              "display_order": 1
            },
            {
              "code": "hourglass-hard-score",
              "name": "Against the Sand",
              "name_zh": "逆沙而上",
              "criterion": "score_at_least",
              "target": 1200,
              "display_order": 2
            }
          ],
          "layout": "hourglass_hard.txt",
          "layout_content": "4 X X X X X X X X X X X X X X X X 4 \nX 4 X           H1            X 4 X \nX X 4 X                     X 4 X X \nX   X 4 X                 X 4 X   X \nX     X 4 X             X 4 X     X \nX       X 4 X         X 4 X       X \nX         X             X         X \nX     B1  S             S     H0  X \nX       K0          C2            X \nX                                 X \nX         S             S   B2    X \nX         X             X         X \nX       X 4 X         X 4 X       X \nX     X 4 X             X 4 X     X \nX   X 4 X                 X 4 X   X \nX X 4 X           H2        X 4 X X \nX 4 X                         X 4 X \n4 X X X X X X X X X X X X X X X X 4 "
        },
        "master": {
          "time": 140,
          "spawn_interval": 5,
          "score_increase_from_hole_capture_modifier": 1.3,
          "score_decrease_from_wrong_hole_modifier": 1.3,
          "timed_tile_lifetime_seconds": 50,
          "balls": [
            "green",
            "grey",
            "grey",
            "blue",
            "yellow",
            "orange",
            "blue",
            "grey",
            "green",
            "orange"
          ],
          "achievements": [
            {
              "code": "hourglass-master-score",
              "name": "Golden Hour",
              "name_zh": "黄金时刻",
              "criterion": "score_at_least",
              "target": 1200,
              "display_order": 1
            },
            {
              "code": "hourglass-master-perfect",
              "name": "Flawless Flow",
              "name_zh": "流沙无瑕",
              "criterion": "no_wrong_captures",
              "display_order": 2
            },
            {
              "code": "hourglass-master-time",
              "name": "Sand Still Falling",
              "name_zh": "沙漏未尽",
              "criterion": "max_duration_seconds",
              "target": 120,
              "display_order": 3
            }
          ],
          "layout": "hourglass_master.txt",
          "layout_content": "4 X X X X X X X X X X X X X X X X 4 \nX 4 X           H1            X 4 X \nX X 4 X                     X 4 X X \nX   X 4 X                 X 4 X   X \nX     X 4 X             X 4 X     X \nX       X 4 X         X 4 X       X \nX         X             X         X \nX     B1  S             S     H0  X \nX       K0          C2            X \nX         T       u               X \nX         S             S   B2    X \nX         X             X         X \nX       X 4 X         X 4 X       X \nX     X 4 X             X 4 X     X \nX   X 4 X                 X 4 X   X \nX X 4 X           H2        X 4 X X \nX 4 X                         X 4 X \n4 X X X X X X X X X X X X X X X X 4 "
        }
      }
    },
    {
      "id": "palette",
      "name": "Palette",
      "official": true,
      "author": "Spherail",
      "difficulties": {
        "easy": {
          "time": 200,
          "spawn_interval": 7,
          "score_increase_from_hole_capture_modifier": 1.0,
          "score_decrease_from_wrong_hole_modifier": 1.0,
          "max_preplaced": 2,
          "balls": [
            "grey",
            "blue"
          ],
          "achievements": [
            {
              "code": "palette-easy-clear",
              "name": "First Splash",
              "name_zh": "初染调色盘",
              "criterion": "clear",
              "display_order": 1
            }
          ],
          "layout": "palette_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0  H1  H2  H3  H4    X     H0  X \nX                       X         X \nX                       X         X \nX                                 X \nX                                 X \nX 1       B3                    3 X \nX 1                             3 X \nX 1                             3 X \nX 1                             3 X \nX 2                             4 X \nX 2           B2                4 X \nX 2                             4 X \nX 2             S               4 X \nX X X X X X X X X X X             X \nX                                 X \nX   S                             X \nX X X X X X X X X X X X X X X X X X "
        },
        "hard": {
          "time": 165,
          "spawn_interval": 6,
          "score_increase_from_hole_capture_modifier": 1.2,
          "score_decrease_from_wrong_hole_modifier": 1.1,
          "max_preplaced": 4,
          "balls": [
            "grey",
            "blue",
            "green",
            "orange"
          ],
          "achievements": [
            {
              "code": "palette-hard-perfect",
              "name": "True Colours",
              "name_zh": "本色出演",
              "criterion": "no_wrong_captures",
              "display_order": 1
            },
            {
              "code": "palette-hard-score",
              "name": "Colour Theory",
              "name_zh": "色彩学满分",
              "criterion": "score_at_least",
              "target": 950,
              "display_order": 2
            }
          ],
          "layout": "palette_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0  H1  H2  H3  H4    X     H0  X \nX                       X         X \nX                       X         X \nX         K0            C2        X \nX             K1                  X \nX 1       B3                    3 X \nX 1   C1                    C3  3 X \nX 1                             3 X \nX 1         K3                  3 X \nX 2                             4 X \nX 2           B2                4 X \nX 2                             4 X \nX 2             S               4 X \nX X X X X X X X X X X             X \nX   B0  B0                        X \nX   S                             X \nX X X X X X X X X X X X X X X X X X "
        },
        "master": {
          "time": 135,
          "spawn_interval": 5,
          "score_increase_from_hole_capture_modifier": 1.3,
          "score_decrease_from_wrong_hole_modifier": 1.3,
          "timed_tile_lifetime_seconds": 35,
          "balls": [
            "grey",
            "grey",
            "grey",
            "blue",
            "green",
            "orange",
            "yellow",
            "grey",
            "blue"
          ],
          "achievements": [
            {
              "code": "palette-master-score",
              "name": "Masterpiece",
              "name_zh": "大作落成",
              "criterion": "score_at_least",
              "target": 1300,
              "display_order": 1
            },
            {
              "code": "palette-master-perfect",
              "name": "No Muddy Colours",
              "name_zh": "拒绝脏色",
              "criterion": "no_wrong_captures",
              "display_order": 2
            },
            {
              "code": "palette-master-lines",
              "name": "Eight-Stroke Painting",
              "name_zh": "八笔成画",
              "criterion": "max_lines_drawn",
              "target": 8,
              "display_order": 3
            }
          ],
          "layout": "palette_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0  H1  H2  H3  H4    X     H0  X \nX                       X         X \nX                       X         X \nX         K0            C2        X \nX             K1                  X \nX 1       B3                    3 X \nX 1   C1                    C3  3 X \nX 1                             3 X \nX 1         K3                  3 X \nX 2                             4 X \nX 2           B2                4 X \nX 2                             4 X \nX 2             S               4 X \nX X X X X X X X X X X T   G0      X \nX   B0  B0                        X \nX   S B0                          X \nX X X X X X X X X X X X X X X X X X "
        }
      }
    },
    {
      "id": "crossroads",
      "name": "Crossroads",
      "official": true,
      "author": "Spherail",
      "difficulties": {
        "easy": {
          "time": 190,
          "spawn_interval": 7,
          "score_increase_from_hole_capture_modifier": 1.0,
          "score_decrease_from_wrong_hole_modifier": 1.0,
          "balls": [
            "blue",
            "grey",
            "orange"
          ],
          "achievements": [
            {
              "code": "crossroads-easy-no-lines",
              "name": "Hands-Off Driver",
              "name_zh": "无墨驾驶",
              "criterion": "max_lines_drawn",
              "target": 0,
              "display_order": 1
            }
          ],
          "layout": "crossroads_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX                                 X \nX             H1                  X \nX     B2                          X \nX                 S               X \nX             2 2 2 2             X \nX         2 2         2 2         X \nX       2                 2       X \nX       2                 2       X \nX         2 2         2 2         X \nX             2 2 2 2             X \nX                 S               X \nX                                 X \nX     H0                    H2    X \nX                                 X \nX                                 X \nX                                 X \nX X X X X X X X X X X X X X X X X X "
        },
        "hard": {
          "time": 155,
          "spawn_interval": 6,
          "score_increase_from_hole_capture_modifier": 1.15,
          "score_decrease_from_wrong_hole_modifier": 1.1,
          "balls": [
            "blue",
            "grey",
            "orange",
            "green",
            "blue",
            "grey",
            "yellow"
          ],
          "achievements": [
            {
              "code": "crossroads-hard-perfect",
              "name": "No Wrong Turns",
              "name_zh": "绝不走错",
              "criterion": "no_wrong_captures",
              "display_order": 1
            },
            {
              "code": "crossroads-hard-score",
              "name": "Rush Hour",
              "name_zh": "高峰畅行",
              "criterion": "score_at_least",
              "target": 900,
              "display_order": 2
            }
          ],
          "layout": "crossroads_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX                                 X \nX             H1                  X \nX     B2                          X \nX         K0      S               X \nX             2 2 2 2             X \nX         2 2         2 2         X \nX       2                 2       X \nX       2                 2       X \nX         2 2         2 2         X \nX             2 2 2 2             X \nX                 S               X \nX             K2                  X \nX     H0                    H2    X \nX           U           D         X \nX                     C2          X \nX                                 X \nX X X X X X X X X X X X X X X X X X "
        },
        "master": {
          "time": 118,
          "spawn_interval": 4,
          "score_increase_from_hole_capture_modifier": 1.3,
          "score_decrease_from_wrong_hole_modifier": 1.3,
          "timed_tile_lifetime_seconds": 40,
          "balls": [
            "blue",
            "grey",
            "orange",
            "green",
            "blue",
            "grey",
            "yellow",
            "orange",
            "blue",
            "grey",
            "green",
            "grey"
          ],
          "achievements": [
            {
              "code": "crossroads-master-score",
              "name": "All Roads Lead Home",
              "name_zh": "殊途同归",
              "criterion": "score_at_least",
              "target": 1150,
              "display_order": 1
            },
            {
              "code": "crossroads-master-perfect",
              "name": "Perfect Navigator",
              "name_zh": "导航满分",
              "criterion": "no_wrong_captures",
              "display_order": 2
            },
            {
              "code": "crossroads-master-time",
              "name": "Green Wave",
              "name_zh": "一路绿灯",
              "criterion": "max_duration_seconds",
              "target": 100,
              "display_order": 3
            }
          ],
          "layout": "crossroads_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX                                 X \nX             H1                  X \nX     B2                          X \nX         K0      S               X \nX             2 2 2 2             X \nX         2 2         2 2         X \nX       2                 2       X \nX       2                 2       X \nX         2 2         2 2         X \nX             2 2 2 2             X \nX                 S               X \nX             K2                  X \nX     H0                    H2    X \nX           U           D         X \nX           G0        C2          X \nX                 T               X \nX X X X X X X X X X X X X X X X X X "
        }
      }
    },
    {
      "id": "chambers",
      "name": "Chambers",
      "official": true,
      "author": "Spherail",
      "difficulties": {
        "easy": {
          "time": 220,
          "spawn_interval": 8,
          "score_increase_from_hole_capture_modifier": 1.0,
          "score_decrease_from_wrong_hole_modifier": 1.0,
          "balls": [
            "orange",
            "blue",
            "grey"
          ],
          "achievements": [
            {
              "code": "chambers-easy-clear",
              "name": "Open Sesame",
              "name_zh": "芝麻开门",
              "criterion": "clear",
              "display_order": 1
            }
          ],
          "layout": "chambers_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0          X     X         H1  X \nX             X     X             X \nX             S     S             X \nX     B1      X     X     B2      X \nX             X     X             X \nX             X     X             X \nX X X X X X X         X X X X X X X \nX                                 X \nX                 H2              X \nX                                 X \nX                                 X \nX                 S               X \nX                                 X \nX                                 X \nX                                 X \nX                                 X \nX X X X X X X X X X X X X X X X X X "
        },
        "hard": {
          "time": 175,
          "spawn_interval": 6,
          "score_increase_from_hole_capture_modifier": 1.15,
          "score_decrease_from_wrong_hole_modifier": 1.1,
          "balls": [
            "orange",
            "blue",
            "grey",
            "green",
            "yellow",
            "grey",
            "blue"
          ],
          "achievements": [
            {
              "code": "chambers-hard-perfect",
              "name": "Room Service",
              "name_zh": "一室不乱",
              "criterion": "no_wrong_captures",
              "display_order": 1
            },
            {
              "code": "chambers-hard-score",
              "name": "Treasure Hunter",
              "name_zh": "寻宝达人",
              "criterion": "score_at_least",
              "target": 1100,
              "display_order": 2
            }
          ],
          "layout": "chambers_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0          X     X         H1  X \nX         K0  X     X             X \nX             S     S             X \nX     B1      X     X     B2      X \nX             X     X             X \nX             X     X             X \nX X X X X X X         X X X X X X X \nX                                 X \nX                 H2              X \nX             K0      C2          X \nX           U             D       X \nX                 S               X \nX                                 X \nX                                 X \nX                                 X \nX                                 X \nX X X X X X X X X X X X X X X X X X "
        },
        "master": {
          "time": 148,
          "spawn_interval": 5,
          "score_increase_from_hole_capture_modifier": 1.3,
          "score_decrease_from_wrong_hole_modifier": 1.3,
          "timed_tile_lifetime_seconds": 45,
          "balls": [
            "orange",
            "blue",
            "grey",
            "green",
            "yellow",
            "grey",
            "blue",
            "orange",
            "grey",
            "green",
            "blue",
            "yellow",
            "grey"
          ],
          "achievements": [
            {
              "code": "chambers-master-score",
              "name": "Lord of the Labyrinth",
              "name_zh": "迷宫之主",
              "criterion": "score_at_least",
              "target": 1400,
              "display_order": 1
            },
            {
              "code": "chambers-master-perfect",
              "name": "Every Room in Order",
              "name_zh": "间间无误",
              "criterion": "no_wrong_captures",
              "display_order": 2
            },
            {
              "code": "chambers-master-lines",
              "name": "Ten-Stroke Unlock",
              "name_zh": "十笔开锁",
              "criterion": "max_lines_drawn",
              "target": 10,
              "display_order": 3
            }
          ],
          "layout": "chambers_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H0          X     X         H1  X \nX         K0  X     X             X \nX             S     S             X \nX     B1      X     X     B2      X \nX             X     X             X \nX             X     X             X \nX X X X X X X         X X X X X X X \nX         T                       X \nX                 H2              X \nX             K0      C2          X \nX           U             D       X \nX                 S               X \nX             Y1    V1            X \nX             G0                  X \nX                                 X \nX                                 X \nX X X X X X X X X X X X X X X X X X "
        }
      }
    },
    {
      "id": "spectrum-gates",
      "name": "色阶闸阵",
      "name_en": "Spectrum Gates",
      "official": true,
      "author": "荧麻了",
      "difficulties": {
        "easy": {
          "layout": "spectrum-gates_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX B0    C1R1    X X           H0  X \nX       C1R1    C4R4              X \nX       C1R1    C4R4          H0  X \nX B1    C0R0    C4R4              X \nX       C0R0    C3R3          H0  X \nX       C0R0    C3R3              X \nX B2    C2R2    C3R3          H0  X \nX       C2R2    C2R2              X \nX       C2R2    C2R2          H0  X \nX B3    C3R3    C2R2              X \nX       C3R3    C0R0          H0  X \nX       C3R3    C0R0              X \nX B4    C4R4    C0R0          H0  X \nX       C4R4    C1R1              X \nX       C4R4    C1R1          H0  X \nX S     X X     C1R1              X \nX X X X X X X X X X X X X X X X X X ",
          "time": 100,
          "spawn_interval": 4,
          "balls": [],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "spectrum-gates-easy-clear",
              "name": "Follow the Spectrum",
              "name_zh": "循色而行",
              "criterion": "clear",
              "display_order": 1
            }
          ]
        },
        "hard": {
          "layout": "spectrum-gates_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX B0    C1R1    X X         K0H0  X \nX B1    C1R1    C4R4        K0    X \nX B2    C1R1    C4R4        K0H0  X \nX B3    C0R0    C4R4        K0    X \nX B4    C0R0    C3R3        K0H0  X \nX       C0R0    C3R3        K0    X \nX       C2R2    C3R3        K0H0  X \nX       C2R2    C2R2        K0    X \nX       C2R2    C2R2        K0H0  X \nX       C3R3    C2R2        K0    X \nX       C3R3    C0R0        K0H0  X \nX       C3R3    C0R0        K0    X \nX       C4R4    C0R0        K0H0  X \nX       C4R4    C1R1        K0    X \nX       C4R4    C1R1        K0H0  X \nX S     X X     C1R1        K0    X \nX X X X X X X X X X X X X X X X X X ",
          "time": 200,
          "spawn_interval": 10,
          "balls": [
            "grey",
            "orange",
            "blue",
            "green",
            "yellow"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "spectrum-gates-hard-clear",
              "name": "Through the Gates",
              "name_zh": "连闸贯通",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "spectrum-gates-hard-swift",
              "name": "Swift Passage",
              "name_zh": "闸阵疾行",
              "criterion": "max_duration_seconds",
              "target": 180,
              "display_order": 2
            }
          ]
        },
        "master": {
          "layout": "spectrum-gates_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX B0    C1R1    X X         K0H0  X \nX B1    C1R1    C4R4K4      K0    X \nX B2    C1R1    C4R4K4      K0H0  X \nX B3    C0R0    C4R4K4      K0    X \nX B4    C0R0    C3R3K3      K0H0  X \nX       C0R0    C3R3K3      K0    X \nX       C2R2    C3R3K3      K0H0  X \nX       C2R2    C2R2K2      K0    X \nX       C2R2    C2R2K2      K0H0  X \nX       C3R3    C2R2K2      K0    X \nX       C3R3    C0R0K0      K0H0  X \nX       C3R3    C0R0K0      K0    X \nX       C4R4    C0R0K0      K0H0  X \nX       C4R4    C1R1K1      K0    X \nX       C4R4    C1R1K1      K0H0  X \nX S     X X     C1R1K1      K0    X \nX X X X X X X X X X X X X X X X X X ",
          "time": 200,
          "spawn_interval": 10,
          "balls": [
            "grey",
            "orange",
            "blue",
            "green",
            "yellow"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "spectrum-gates-master-clear",
              "name": "Breakthrough",
              "name_zh": "破壁穿关",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "spectrum-gates-master-swift",
              "name": "Swift Passage",
              "name_zh": "闸阵疾行",
              "criterion": "max_duration_seconds",
              "target": 180,
              "display_order": 2
            },
            {
              "code": "spectrum-gates-master-precision",
              "name": "Measured Strokes",
              "name_zh": "落笔有方",
              "display_order": 3,
              "criterion": "max_lines_drawn",
              "target": 60
            }
          ]
        }
      }
    },
    {
      "id": "chromatic-locks",
      "name": "四色锁廊",
      "name_en": "Chromatic Locks",
      "official": true,
      "author": "荧麻了",
      "difficulties": {
        "easy": {
          "layout": "chromatic-locks_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX 1 B1B11 2 B2B22 3 B3B33 4 B4B44 X \nX 1 V1  1 2 V2  2 3 V3  3 4 V4  4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX C1C1C1C1C2C2C2C2C3C3C3C3C4C4C4C4X \nX C1H1  C1C2H2  C2C3H3  C3C4H4  C4X \nX C1    C1C2    C2C3    C3C4    C4X \nX X X X X X X X X X X X X X X X X X ",
          "time": 60,
          "spawn_interval": 4,
          "balls": [],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "chromatic-locks-easy-clear",
              "name": "Four Keys",
              "name_zh": "初解四色",
              "criterion": "clear",
              "display_order": 1
            }
          ]
        },
        "hard": {
          "layout": "chromatic-locks_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX 1 V1S 1 2 V2S 2 3 V3S 3 4 V4S 4 X \nX 1 B1B11 2 B2B22 3 B3B33 4 B4B44 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX C1C1C1C1C2C2C2C2C3C3C3C3C4C4C4C4X \nX C1H1  C1C2H2  C2C3H3  C3C4H4  C4X \nX C1    C1C2    C2C3    C3C4    C4X \nX X X X X X X X X X X X X X X X X X ",
          "time": 120,
          "spawn_interval": 6,
          "balls": [
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "chromatic-locks-hard-clear",
              "name": "Open Passage",
              "name_zh": "锁廊畅行",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "chromatic-locks-hard-swift",
              "name": "Quick Unlock",
              "name_zh": "锁廊快手",
              "criterion": "max_duration_seconds",
              "target": 105,
              "display_order": 2
            }
          ]
        },
        "master": {
          "layout": "chromatic-locks_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX 1 V1S 1 2 V2S 2 3 V3S 3 4 V4S 4 X \nX 1 B1B11 2 B2B22 3 B3B33 4 B4B44 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1 Y1Y11 2 Y2Y22 3 Y3Y33 4 Y4Y44 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX 1     1 2     2 3     3 4     4 X \nX G1C1C1G1G2C2C2G2G3C3C3G3G4C4C4G4X \nX G1H1  G1G2H2  G2G3H3  G3G4H4  G4X \nX G1    G1G2    G2G3    G3G4    G4X \nX X X X X X X X X X X X X X X X X X ",
          "time": 120,
          "spawn_interval": 6,
          "balls": [
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey",
            "grey"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "chromatic-locks-master-clear",
              "name": "Double Unlock",
              "name_zh": "双锁皆开",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "chromatic-locks-master-swift",
              "name": "Quick Unlock",
              "name_zh": "锁廊快手",
              "criterion": "max_duration_seconds",
              "target": 105,
              "display_order": 2
            },
            {
              "code": "chromatic-locks-master-precision",
              "name": "Key Technique",
              "name_zh": "开锁有方",
              "display_order": 3,
              "criterion": "max_lines_drawn",
              "target": 48
            }
          ]
        }
      }
    },
    {
      "id": "shifting-hours",
      "name": "时隙交织",
      "name_en": "Shifting Hours",
      "official": true,
      "author": "荧麻了",
      "difficulties": {
        "easy": {
          "layout": "shifting-hours_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S           TAH1  H1    T       X \nX           TA          T         X \nX         TA          T           X \nX       TAB4        T             X \nX     TAB4        T               X \nX   TAB4      B1T                 X \nX TA        B1T                   X \nX H4        T                     X \nX         T                     ToX \nX H4    T                     To  X \nX     T                     To    X \nX   T                     To      X \nX T                     To    H2  X \nX                     To          X \nX                   To    H2  H2  X \nX                 To              X \nX X X X X X X X X X X X X X X X X X ",
          "time": 100,
          "spawn_interval": 4,
          "balls": [
            "yellow",
            "yellow",
            "orange",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "shifting-hours-easy-clear",
              "name": "Wait for the Moment",
              "name_zh": "静候时机",
              "criterion": "clear",
              "display_order": 1
            }
          ]
        },
        "hard": {
          "layout": "shifting-hours_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S           T9H1  H1    T       X \nX           T9          T         X \nX         T9          T           X \nX       T9B4        T             X \nX     T9B4        T               X \nX   T9B4      B1T B2              X \nX T9        B1T                   X \nX H4        T   B2                X \nX         T B2                  ToX \nX H4    T                     To  X \nX     T                     To    X \nX   T                     To      X \nX T                     To    H2  X \nX                     To          X \nX                   T     H2  H2  X \nX                 T               X \nX X X X X X X X X X X X X X X X X X ",
          "time": 100,
          "spawn_interval": 4,
          "balls": [
            "yellow",
            "yellow",
            "orange",
            "orange",
            "blue",
            "blue"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "shifting-hours-hard-clear",
              "name": "Crossing in Time",
              "name_zh": "错峰穿行",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "shifting-hours-hard-swift",
              "name": "Seize the Moment",
              "name_zh": "抢占时隙",
              "criterion": "max_duration_seconds",
              "target": 90,
              "display_order": 2
            }
          ]
        },
        "master": {
          "layout": "shifting-hours_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S           T H1  H1    T   H3  X \nX           T           T         X \nX         T           T           X \nX       T B4        T             X \nX     T B4        T               X \nX   T B4      B1T B3              X \nX T         B1T B3                X \nX H4        T B3                  X \nX         T B3                  ToX \nX H4    T                   B2To  X \nX     T                   B2To    X \nX   T                   B2T       X \nX T                   B2T     H2  X \nX                     To          X \nX H3                To    H2  H2  X \nX                 To              X \nX X X X X X X X X X X X X X X X X X ",
          "time": 190,
          "spawn_interval": 4,
          "balls": [
            "yellow",
            "yellow",
            "orange",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "shifting-hours-master-clear",
              "name": "Between the Hours",
              "name_zh": "时隙穿梭",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "shifting-hours-master-swift",
              "name": "Seize the Moment",
              "name_zh": "抢占时隙",
              "criterion": "max_duration_seconds",
              "target": 170,
              "display_order": 2
            },
            {
              "code": "shifting-hours-master-precision",
              "name": "Perfect Timing",
              "name_zh": "丝毫不差",
              "display_order": 3,
              "criterion": "no_wrong_captures"
            }
          ]
        }
      }
    },
    {
      "id": "oneway-labyrinth",
      "name": "单行迷宫",
      "name_en": "One-Way Labyrinth",
      "official": true,
      "author": "荧麻了",
      "difficulties": {
        "easy": {
          "layout": "oneway-labyrinth_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX     L1          R1      R1    S X \nX     L1          R1      R1      X \nX D1D11 U1U1U1D1D11 D1D1D11 D1D1D1X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX D1D11 D1D1D1U1U11 D1D1D11 D1D1D1X \nX     L1          R1      L1      X \nX     L1          R1      L1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX     L1          L1      R1      X \nX H1  L1          L1      R1      X \nX     L1          L1      R1      X \nX X X X X X X X X X X X X X X X X X ",
          "time": 100,
          "spawn_interval": 4,
          "balls": [
            "orange",
            "orange",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "oneway-labyrinth-easy-clear",
              "name": "Way Out",
              "name_zh": "找到出口",
              "criterion": "clear",
              "display_order": 1
            }
          ]
        },
        "hard": {
          "layout": "oneway-labyrinth_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H1  L1          R1      R1      X \nX     L1          R1      R1      X \nX U1U11 U1U1U1D1D11 D1D1D11 D1D1D1X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX D1D11 D1U1U1U1U11 D1D1D11 D1D1D1X \nX     L1          L1      L1      X \nX     L1          L1      L1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX D1D11 D1D1D1U1U11 D1D1D11 U1U1U1X \nX     L1          R1      R1      X \nX     R1          L1      R1      X \nX     R1          L1      R1      X \nX     L1          L1      R1    S X \nX X X X X X X X X X X X X X X X X X ",
          "time": 120,
          "spawn_interval": 4,
          "balls": [
            "orange",
            "orange",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "oneway-labyrinth-hard-clear",
              "name": "Trace the Route",
              "name_zh": "逆路寻踪",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "oneway-labyrinth-hard-swift",
              "name": "Shortcut Navigator",
              "name_zh": "捷径领航",
              "criterion": "max_duration_seconds",
              "target": 105,
              "display_order": 2
            }
          ]
        },
        "master": {
          "layout": "oneway-labyrinth_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX H1  L1          R1      R1      X \nX     L1          R1      R1      X \nX D1D11 D1D1U1U1U11 D1D1D11 D1D1D1X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX D1D11 D1U1U1U1U11 D1D1D11 D1D1D1X \nX     L1          L1      L1      X \nX     L1          L1      L1      X \nX     L1          R1      R1      X \nX     L1          R1      R1      X \nX D1D11 D1D1D1U1U11 D1D1D11 U1U1U1X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX     R1          R1      R1      X \nX     R1          R1      R1    S X \nX X X X X X X X X X X X X X X X X X ",
          "time": 200,
          "spawn_interval": 15,
          "balls": [
            "orange",
            "orange",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "oneway-labyrinth-master-clear",
              "name": "Master Navigator",
              "name_zh": "单行领航",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "oneway-labyrinth-master-swift",
              "name": "Shortcut Navigator",
              "name_zh": "捷径领航",
              "criterion": "max_duration_seconds",
              "target": 180,
              "display_order": 2
            },
            {
              "code": "oneway-labyrinth-master-precision",
              "name": "Every Stroke Counts",
              "name_zh": "惜墨如金",
              "display_order": 3,
              "criterion": "max_lines_drawn",
              "target": 48
            }
          ]
        }
      }
    },
    {
      "id": "cascade-junction",
      "name": "分流急湾",
      "name_en": "Cascade Junction",
      "official": true,
      "author": "荧麻了",
      "difficulties": {
        "easy": {
          "layout": "cascade-junction_easy.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S               T             d X \nX                   T         d d X \nX           T         T     d d d X \nX             T         T r r d d X \nX               T       d X r H0  X \nX     T           T   r d d X     X \nX       T           X r r d d X u X \nX         T       r d X r r d d X X \nX           T   r r d d X r r H4  X \nX T           X r r d d d X r     X \nX   T       d d X r r d d d X u u X \nX     T   r d d d X r r d d d X u X \nX       X r r d d d X r r d d d X X \nX     r d X r r d d d X r r d d d X \nX   r r H0  X r r H3  l X r r H1  X \nX r r r     l X r     l l X r     X \nX X X X X X X X X X X X X X X X X X ",
          "time": 60,
          "spawn_interval": 5,
          "balls": [
            "orange",
            "yellow",
            "green"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "cascade-junction-easy-clear",
              "name": "Into the Bay",
              "name_zh": "顺流入湾",
              "criterion": "clear",
              "display_order": 1
            }
          ]
        },
        "hard": {
          "layout": "cascade-junction_hard.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S               T             d X \nX                   T         d d X \nX           T         T     d d d X \nX             T         T r r d d X \nX               T       d X r H0  X \nX     T           T   r d d X     X \nX       T           X r r d d X u X \nX         T       r d X r r d d X X \nX           T   r r d d X r r H4  X \nX T           X r r d d d X r     X \nX   T       d d X r r d d d X u u X \nX     T   r d d d X r r d d d X u X \nX       X r r d d d X r r d d d X X \nX     r d X r r d d d X r r d d d X \nX   r r H0  X r r H3  l X r r H1  X \nX r r r     l X r     l l X r     X \nX X X X X X X X X X X X X X X X X X ",
          "time": 120,
          "spawn_interval": 5,
          "balls": [
            "orange",
            "yellow",
            "green",
            "orange",
            "green",
            "yellow",
            "orange",
            "green",
            "yellow",
            "grey",
            "green",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "cascade-junction-hard-clear",
              "name": "Order in the Rapids",
              "name_zh": "分流有序",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "cascade-junction-hard-swift",
              "name": "Rapid Delivery",
              "name_zh": "急流快递",
              "criterion": "max_duration_seconds",
              "target": 105,
              "display_order": 2
            }
          ]
        },
        "master": {
          "layout": "cascade-junction_master.txt",
          "layout_content": "X X X X X X X X X X X X X X X X X X \nX S               TÈ            d X \nX                   TÈ        d d X \nX     r d d X         TÈ    d d d X \nX     r d d d X         TÈr r d d X \nX     r r r r d X       d X r H0  X \nX     X r r r r d X   r d d X     X \nX       X r r r r d X r r d d X u X \nX         X r r r r d X r r d d X X \nX           X r r r d d X r r H4  X \nX TÈ          X r r d d d X r     X \nX   TÈ      d d X r r d d d X u u X \nX     TÈ  r d d d X r r d d d X u X \nX       X r r d d d X r r d d d X X \nX     r d X r r d d d X r r d d d X \nX   r r H0  X r r H3  l X r r H1  X \nX r r r     l X r     l l X r     X \nX X X X X X X X X X X X X X X X X X ",
          "time": 160,
          "spawn_interval": 5,
          "balls": [
            "orange",
            "yellow",
            "green",
            "orange",
            "green",
            "yellow",
            "orange",
            "green",
            "yellow",
            "grey",
            "green",
            "orange"
          ],
          "author_history": [
            "荧麻了"
          ],
          "score_increase_from_hole_capture_modifier": 1,
          "score_decrease_from_wrong_hole_modifier": 1,
          "achievements": [
            {
              "code": "cascade-junction-master-clear",
              "name": "Cascade Pilot",
              "name_zh": "急湾领航",
              "criterion": "clear",
              "display_order": 1
            },
            {
              "code": "cascade-junction-master-swift",
              "name": "Rapid Delivery",
              "name_zh": "急流快递",
              "criterion": "max_duration_seconds",
              "target": 145,
              "display_order": 2
            },
            {
              "code": "cascade-junction-master-precision",
              "name": "Perfect Sorting",
              "name_zh": "分色无误",
              "display_order": 3,
              "criterion": "no_wrong_captures"
            }
          ]
        }
      }
    }
  ],
  "score_increase_from_hole_capture": {
    "grey": 70,
    "orange": 50,
    "blue": 50,
    "green": 50,
    "yellow": 100
  },
  "score_decrease_from_wrong_hole": {
    "grey": 0,
    "orange": 25,
    "blue": 25,
    "green": 25,
    "yellow": 100
  }
};

(function () {
  'use strict';

  // The website catalogue covers shared game terms. These entries cover the
  // offline desktop flows, including copy that has no server-side equivalent.
  const desktopEnglish = {
    '连接同一局域网': 'Connect to the same local network',
    '请连接同一局域网，并允许防火墙访问专用网络。': 'Connect to the same local network and allow private network access in your firewall.',
    '尚未发现附近的绘轨玩家。请确认双方连接同一局域网，并允许防火墙访问专用网络。': 'No nearby Spherail players found. Connect both computers to the same local network and allow private network access in your firewall.',
    '两台电脑保持绘轨运行，并连接同一 Wi-Fi 或有线局域网。请允许 Windows 防火墙访问专用网络。': 'Keep Spherail running on both computers on the same Wi-Fi or wired network. Allow access to private networks in Windows Firewall.',
    '对战连接中断，正在恢复；本局计时继续。': 'Match connection lost. Reconnecting; the game clock continues.',
    '绘轨': 'SPHERAIL', '绘轨游戏棋盘': 'Spherail game board',
    '绘轨游乐场 · 官方关卡': 'Spherail Arcade · Official Levels',
    '· 确认码：': ' · Confirmation code: ',
    '”吗？此操作无法撤销。': '”? This cannot be undone.',
    'Ⅱ 暂停': 'Ⅱ Pause',
    '一点墨迹，一场巧妙逃脱。': 'A little ink. A clever escape.',
    '上加速': 'Accelerate up', '下加速': 'Accelerate down', '左加速': 'Accelerate left', '右加速': 'Accelerate right',
    '上箭头': 'Up arrow', '下箭头': 'Down arrow', '左箭头': 'Left arrow', '右箭头': 'Right arrow',
    '两台 Mac 均需打开绘轨和蓝牙。Wi-Fi 与互联网无需开启。': 'Open Spherail and enable Bluetooth on both Macs. Wi-Fi and internet are not required.',
    '个人 ·': 'Personal ·', '主导航': 'Main navigation', '你': 'You',
    '保存地图': 'Save map', '修改用户名和头像': 'Edit player name, avatar, and language',
    '倒计时': 'Time limit', '关卡信息': 'Level information', '分享当前难度': 'Export map',
    '创建房间': 'Create room', '删除地图': 'Delete map', '删除地图？': 'Delete map?',
    '制作地图': 'Workshop', '单向门': 'One-way gate', '发球点': 'Spawn point',
    '发球顺序': 'Ball order', '发送这张地图': 'Send this map', '变色墙': 'Colour wall',
    '地图代码': 'Map code', '地图素材': 'Map tiles', '地图编辑网格': 'Map editor grid',
    '地图难度': 'Map difficulty', '墙': 'Wall', '复制': 'Copy', '大师': 'Master',
    '对手': 'Opponent', '对手棋盘': 'Opponent board', '对手：': 'Opponent: ',
    '导出地图': 'Export map', '编辑地图': 'Edit map', '返回': 'Back', '尚未连接': 'Not connected',
    '开关': 'Switch', '开始比赛': 'Start match', '开始游戏': 'Start game',
    '当前方块': 'Current tile', '当前颜色': 'Current colour', '小球总数': 'Total balls', '待发球': 'Ball queue',
    '待发球顺序': 'Upcoming ball order', '得分': 'Score', '我的地图': 'My map',
    '排序': 'Sort maps', '接受连接': 'Accept connection', '撤销': 'Undo',
    '擦除': 'Erase', '擦除素材': 'Erase tiles', '放弃修改': 'Discard changes',
    '放弃未保存的修改？': 'Discard unsaved changes?', '放置素材': 'Place tiles',
    '最早编辑': 'Oldest first', '最近一局': 'Latest run', '最近编辑': 'Recently edited',
    '机关墙': 'Mechanism wall', '查找附近 Mac': 'Find nearby Macs',
    '橙': 'Orange', '橙墙': 'Orange wall', '橡皮擦': 'Eraser',
    '没有找到符合条件的地图。': 'No maps match your search.',
    '消失前持续多少秒？': 'How many seconds until it disappears?',
    '滑动探索 · 点击地图开始': 'Swipe to explore · Select a map to play',
    '灰': 'Grey', '玩家资料': 'Player profile', '现在离开将判负。': 'Leaving now will forfeit the match.',
    '3D 地图预览': '3D map preview', '3D 模式暂不支持对战': '3D mode does not support duels yet',
    '无法加载 3D 地图，请重试。': 'Could not load the 3D map. Please try again.',
    '正在加载 3D 地图…': 'Loading the 3D map…', '锁定视角': 'Lock camera', '解锁视角': 'Unlock camera',
    '用户名': 'Player name', '确定删除“': 'Delete “', '秒': 's',
    '等待对手棋盘': 'Waiting for opponent board', '结果': 'Result',
    '绘画工具': 'Drawing tools', '继续比赛': 'Continue match', '继续编辑': 'Keep editing',
    '绿': 'Green', '绿墙': 'Green wall', '蓝': 'Blue', '蓝墙': 'Blue wall',
    '蓝牙对战': 'Bluetooth match', '蓝牙': 'Bluetooth', 'Wi-Fi + 蓝牙': 'Wi-Fi + Bluetooth',
    '对战': 'Match', '计时墙': 'Timed wall',
    '该设置只应用于当前选中的限时墙。': 'This setting applies only to the selected timed wall.',
    '请与对方当面核对确认码。': 'Confirm this code with your opponent in person.',
    '返回制作地图': 'Back to created maps', '返回官方地图': 'Back to official maps',
    '进阶': 'Advanced', '退出后，本次编辑的内容将不会保存。': 'Your edits will be lost if you leave.',
    '退出对战': 'Leave match', '退出对战？': 'Leave match?',
    '重做': 'Redo', '门': 'Gate',
    '编辑头像': 'Edit avatar', '难度页面透明度预览': 'Difficulty screen transparency preview',
    '向前查看发球顺序': 'View earlier balls', '向后查看发球顺序': 'View later balls',
    '发球顺序预览': 'Ball queue preview', '尚未添加小球': 'No balls added yet',
    '难度页面透明度': 'Difficulty screen transparency',
    '0 为不透明，100 为全透明；保存资料后保留设置。': '0 is opaque and 100 is fully transparent. Save your profile to keep this setting.',
    '头像': 'Avatar', '选择图片并调整头像区域': 'Choose an image and adjust the avatar crop',
    '选择图片': 'Choose image', '恢复默认头像': 'Use default avatar',
    '拖动图片选择头像区域': 'Drag the image to choose the avatar area',
    '头像裁剪区域': 'Avatar crop area', '缩放': 'Zoom',
    '头像保存在本机；接受对战邀请后会发送给对方。': 'Your avatar is saved on this device and sent to your opponent when you accept a match invitation.',
    '保存资料': 'Save profile', '请选择不超过 12 MB 的图片。': 'Choose an image smaller than 12 MB.',
    '无法读取这张图片。': 'Could not read this image.',
    '图片无法压缩到头像大小，请选择另一张图片。': 'Could not compress this image for an avatar. Choose another image.',
    '面对面对战': 'Local match', '预置球': 'Placed ball',
    '黄': 'Yellow', '黄墙': 'Yellow wall', '简体中文': 'Simplified Chinese',
    '语言': 'Language', '选择地图': 'Choose a map', '创意工坊': 'Workshop',
    '新建地图': 'Create map', '编辑': 'Edit', '游玩': 'Play', '删除': 'Delete',
    '自制地图': 'Custom map', '本机玩家': 'Local player',
    '通关': 'Cleared', '时间到': 'Time up', '球与发球点': 'Balls and spawn points',
    '墙与机关': 'Walls and mechanisms', '加速器': 'Accelerators',
    '球洞与开关': 'Holes and switches', '砖块图例': 'Tile guide',
    '颜色墙': 'Colour wall', '可破坏墙': 'Destructible wall',
    '单向墙': 'One-way wall', '限时墙': 'Timed wall', '颜色门': 'Colour gate',
    '钥匙墙': 'Key wall', '墙体开关': 'Wall switch', '洞口': 'Hole',
    '洞口开关': 'Hole switch', '加速砖': 'Accelerator',
    '灰色': 'Grey', '橙色': 'Orange', '蓝色': 'Blue', '绿色': 'Green', '黄色': 'Yellow',
    '展开颜色说明': 'Show colour details',
    '该位置已被占用。': 'This cell is occupied.',
    '请输入地图名称。': 'Enter a map name.',
    '地图名称最多 20 个字符。': 'Map names can have at most 20 characters.',
    '限时应为 1–3600 秒。': 'Time limit must be between 1 and 3600 seconds.',
    '发球间隔应为 0–600 秒。': 'Spawn interval must be between 0 and 600 seconds.',
    '发球颜色只能使用 grey、orange、blue、green、yellow。': 'Ball colours must be grey, orange, blue, green, or yellow.',
    '总时间不能少于发球数量乘以发球间隔。': 'Time limit must cover the ball count multiplied by the spawn interval.',
    '至少添加一个球。': 'Add at least one ball.',
    '发球顺序中有小球时，至少放置一个发球点。': 'Place at least one spawn point when the serve queue contains balls.',
    '至少放置一个球洞。': 'Place at least one hole.',
    '至少添加一个球和一个球洞。': 'Add at least one ball and one hole.',
    '已保存在本机。': 'Saved on this device.',
    '导入地图代码': 'Import map code',
    '已复制到剪切板': 'Copied to clipboard', '已复制到剪贴板。': 'Copied to clipboard.',
    '等待附近 Mac 加入': 'Waiting for a nearby Mac', '正在查找': 'Searching',
    '正在连接': 'Connecting', '收到连接请求': 'Connection request received',
    '已连接': 'Connected', '已选地图': 'Map selected',
    '等待双方准备': 'Waiting for both players', '比赛中': 'Match in progress',
    '连接中断，正在尝试恢复': 'Connection lost; reconnecting',
    '对战已结束': 'Match ended', '附近玩家': 'Nearby player',
    '房主连接后发送所选地图；自制图只保留到本局结束。': 'The host will send the chosen map after connecting. Custom maps are removed after the match.',
    '已准备': 'Ready', '未准备': 'Not ready',
    '返回编辑器': 'Back to editor', '返回地图': 'Back to maps',
    '暂停': 'Paused', '对战进行中': 'Match in progress', '编辑器试玩': 'Editor playtest',
    '等待对手结束': 'Waiting for opponent',
    '胜利': 'Victory', '落败': 'Defeat', '平局': 'Draw', '对战结束': 'Match ended',
    '对手已离开': 'Opponent left', '连接超时': 'Connection timed out',
    '请从地图难度页面进入对战。': 'Start a match from a map difficulty page.',
    '蓝牙连接中断，比赛暂停，正在尝试恢复…': 'Bluetooth connection lost. Match paused while reconnecting…',
    '蓝牙连接中断，正在恢复；本局计时继续。': 'Bluetooth connection lost. Reconnecting; the match clock keeps running.',
    '对手已退出，你可以继续完成本局。': 'Your opponent left. You can finish this round.',
    '对手已完成并离开，你可以继续完成本局。': 'Your opponent finished and left. You can finish this round.',
    '连接超时，你可以继续完成本局。': 'Connection timed out. You can finish this round.',
    '球撞上后会变成对应颜色。': 'A ball takes this colour when it hits the wall.',
    '实心墙，不会改变球的颜色。': 'Solid wall; does not recolour balls.',
    '有效撞击三次后破碎。': 'Breaks after three valid hits.',
    '任意球撞击三次后破碎。': 'Breaks after three hits from any ball.',
    '同色球撞击三次后破碎。': 'Breaks after three hits from matching balls.',
    '只允许球沿箭头方向通过。': 'Balls can pass only in the arrow direction.',
    '同色球可沿箭头方向通过，其他球反弹。': 'Matching balls pass in the arrow direction; others bounce.',
    '显示剩余秒数，倒计时结束后消失。': 'Shows remaining time, then disappears.',
    '匹配颜色的球通过，其他球反弹。': 'Matching balls pass; others bounce.',
    '同色球通过，其他球反弹。': 'Matching balls pass; others bounce.',
    'V 标识表示关闭；触碰同色开关后变为可通行的虚线框。': 'V marks a closed wall. Hit a matching switch to open it, leaving a dashed outline.',
    '切换对应钥匙墙的开关状态。': 'Toggles matching key walls.',
    '任意球可撞击。切换灰色钥匙墙。': 'Any ball can hit it; toggles grey key walls.',
    '灰色或同色球可撞击。切换对应颜色的钥匙墙。': 'Grey or matching balls can hit it; toggles matching key walls.',
    '吸入匹配颜色的球。': 'Captures matching balls.',
    '可以吸入任意颜色的球。': 'Captures any ball.',
    '吸入同色或灰色球；其他颜色会判失误。': 'Captures matching or grey balls; other colours count as misses.',
    '启用或禁用对应颜色的洞。': 'Enables or disables matching holes.',
    '任意球可撞击。启用或禁用所有洞。': 'Any ball can hit it; toggles every hole.',
    '灰色或同色球可撞击。切换对应颜色的洞。': 'Grey or matching balls can hit it; toggles matching holes.',
    '沿箭头方向加速，效果持续 2 秒。': 'Pushes balls in the arrow direction for 2 seconds.',
    '左键：放置素材 · 拖动以调整发球顺序 · 右键：删除': 'Left click: place tiles · Drag to reorder balls · Right click: delete',
    '左键或画笔：画线 · 橡皮、右键或 Control+左键：擦除 · 空格：暂停 · R：重新开始': 'Left click or pen: draw · Eraser, right click, or Control+left click: erase · Space: pause · R: restart',
    '本局地图': 'Match map', '先打开双方蓝牙': 'Enable Bluetooth on both Macs',
    '请在两台 Mac 的系统设置中打开蓝牙，并让双方保持绘轨运行。附近玩家会自动显示，无需手动发送地图。': 'Enable Bluetooth in System Settings on both Macs and keep Spherail open. Nearby players appear automatically; maps are sent with invitations.',
    '打开蓝牙设置': 'Open Bluetooth Settings', '可邀请的绘轨玩家': 'Available Spherail players',
    '选择一位玩家发送本地图和难度的对战邀请。': 'Choose a player to invite with this map and difficulty.',
    '正在寻找附近玩家…': 'Looking for nearby players…',
    '蓝牙已关闭，请在系统设置中开启。': 'Bluetooth is off. Enable it in System Settings.',
    '请在系统设置中允许绘轨使用蓝牙。': 'Allow Spherail to use Bluetooth in System Settings.',
    '尚未发现附近的绘轨玩家。请确认双方已打开蓝牙和绘轨。': 'No nearby Spherail players yet. Check that Bluetooth and Spherail are open on both Macs.',
    '蓝牙已开启': 'Bluetooth enabled', '邀请': 'Invite',
    '绘轨玩家': 'Spherail player',
    '连接同一 Wi-Fi 或打开蓝牙': 'Connect to the same Wi-Fi or enable Bluetooth',
    '两台 Mac 保持绘轨运行，并连接同一 Wi-Fi 或开启蓝牙。附近玩家会自动显示，地图随邀请发送。': 'Keep Spherail open on both Macs and connect to the same Wi-Fi or enable Bluetooth. Nearby players appear automatically; maps are sent with invitations.',
    '尚未发现附近的绘轨玩家。请确认双方连接同一 Wi-Fi 或开启蓝牙。': 'No nearby Spherail players yet. Connect both Macs to the same Wi-Fi or enable Bluetooth.',
    '请连接同一 Wi-Fi 或开启蓝牙。': 'Connect to the same Wi-Fi or enable Bluetooth.',
    '这位玩家已不在同一局域网中。': 'This player is no longer on the local network.',
    'Wi-Fi 和蓝牙均无法连接。': 'Could not connect over Wi-Fi or Bluetooth.',
    'Wi-Fi 邀请中断。': 'The Wi-Fi invitation was interrupted.',
    '等待对方响应': 'Waiting for a response', '对方已接受邀请': 'Invitation accepted',
    '对战即将开始': 'Match starting soon', '取消邀请': 'Cancel invitation',
    '收到对战邀请': 'Match invitation', '接受并开始': 'Accept and start', '拒绝': 'Decline',
    '通道': 'Connection', '延迟': 'Latency', '信号': 'Signal', '本局已结束': 'Your round is over',
    '对手仍在游玩。你可以继续观看对手的地图，或离开对局。': 'Your opponent is still playing. Watch their board or leave the match.',
    '观看对手': 'Watch opponent', '离开对局': 'Leave match',
    '我的棋盘': 'My board', '正在同步对手画面…': 'Syncing opponent board…',
  };

  const webChinese = window.INKBALL_I18N?.zh || {};
  const webEnglish = window.INKBALL_I18N?.en || {};
  const webByChinese = new Map();
  for (const [key, source] of Object.entries(webChinese)) {
    if (typeof source === 'string' && typeof webEnglish[key] === 'string' && !webByChinese.has(source)) {
      webByChinese.set(source, webEnglish[key]);
    }
  }
  for (const map of window.INKBALL_OFFICIAL?.maps || []) {
    for (const level of Object.values(map.difficulties || {})) {
      for (const achievement of level.achievements || []) {
        if (achievement.name_zh && achievement.name) webByChinese.set(achievement.name_zh, achievement.name);
      }
    }
  }
  let language = 'zh';
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['aria-label', 'title', 'placeholder'];

  function translate(source) {
    const trimmed = source.trim();
    if (!trimmed) return source;
    const normalised = trimmed.replace(/\s+/g, ' ');
    let translated = desktopEnglish[normalised] || webByChinese.get(normalised);
    if (!translated) {
      const patterns = [
        [/^(单向墙) · (向上|向下|向左|向右) · (灰色|橙色|蓝色|绿色|黄色)$/, (m) => `${translate(m[1])} · ${translate(m[2])} · ${translate(m[3])}`],
        [/^(小球|颜色墙|可破坏墙|颜色门|钥匙墙|墙体开关|洞口|洞口开关) · (灰色|橙色|蓝色|绿色|黄色)$/, (m) => `${translate(m[1])} · ${translate(m[2])}`],
        [/^(加速砖) · (向上|向下|向左|向右)$/, (m) => `${translate(m[1])} · ${translate(m[2])}`],
        [/^([A-Z]) · ([灰橙蓝绿黄])$/, (m) => `${m[1]} · ${translate(m[2])}`],
        [/^游玩 (.+)$/, (m) => `Play ${m[1]}`],
        [/^(萌新|进阶|大师)：(.+)$/, (m) => `${translate(m[1])}: ${translate(m[2])}`],
        [/^作者 · (.+)$/, (m) => `Author · ${translate(m[1])}`],
        [/^正在编辑 · (.+)$/, (m) => `Editing · ${translate(m[1])}`],
        [/^彩色墙 (\d+)$/, (m) => `Colour wall ${m[1]}`],
        [/^移除第 (\d+) 个 (\w+) 球$/, (m) => `Remove ball ${m[1]} (${m[2]})`],
        [/^加入([灰橙蓝绿黄])球$/, (m) => `Add ${translate(m[1])} ball`],
        [/^导入到(.+)$/, (m) => `Import into ${translate(m[1])}`],
        [/^已导入到(.+)，请保存地图。$/, (m) => `Imported into ${translate(m[1])}. Save the map to keep it.`],
        [/^([灰橙蓝绿黄])色球需要同色球洞、灰色球洞或同色墙。$/, (m) => `${translate(m[1])} balls need a matching hole, grey hole, or matching wall.`],
        [/^(.+) 请求连接$/, (m) => `${translate(m[1])} requests a connection`],
        [/^正在邀请 (.+)…$/, (m) => `Inviting ${m[1]}…`],
        [/^(.+) · (萌新|进阶|大师) · (官方地图|自制地图)$/, (m) => translateMapLine(`${m[1]} · ${m[2]} · ${m[3]}`)],
        [/^本机选择：(.+)$/, (m) => `Local choice: ${translateMapLine(m[1])}`],
        [/^将发送 (.+)$/, (m) => `Sending ${translateMapLine(m[1])}`],
        [/^本局地图：(.+)$/, (m) => `Match map: ${translateMapLine(m[1])}`],
        [/^你(已准备|未准备) · 对手(已准备|未准备)$/, (m) => `You: ${translate(m[1])} · Opponent: ${translate(m[2])}`],
        [/^无法开始游戏：(.+)$/, (m) => `Could not start the game: ${m[1]}`],
        [/^(.+) 加速器$/, (m) => `${m[1]} accelerator`],
        [/^(.+) · (Wi-Fi \+ 蓝牙|Wi-Fi|蓝牙)( · -?\d+ dBm)?$/, (m) =>
          `${m[1]} · ${translate(m[2])}${m[3] || ''}`],
      ];
      for (const [pattern, replace] of patterns) {
        const match = normalised.match(pattern);
        if (match) { translated = replace(match); break; }
      }
    }
    if (!translated) return source;
    return source.replace(trimmed, translated);
  }

  function translateMapLine(source) {
    return source.split(' · ').map((part) => translate(part)).join(' · ');
  }

  function localizeText(node) {
    if (node.parentElement?.closest('script,style,[translate="no"]')) return;
    const current = node.nodeValue || '';
    const previous = textSources.get(node);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = language === 'en' ? translate(source) : source;
    textSources.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function localizeElement(element) {
    if (element.closest('[translate="no"]')) return;
    const previous = attributeSources.get(element) || {};
    for (const name of attributes) {
      const current = element.getAttribute(name);
      if (current == null) continue;
      const stored = previous[name];
      const source = stored && current === stored.rendered ? stored.source : current;
      const rendered = language === 'en' ? translate(source) : source;
      previous[name] = { source, rendered };
      if (current !== rendered) element.setAttribute(name, rendered);
    }
    attributeSources.set(element, previous);
  }

  function localizeTree(root) {
    if (root.nodeType === Node.TEXT_NODE) { localizeText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    localizeElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) localizeText(walker.currentNode);
      else localizeElement(walker.currentNode);
    }
  }

  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type === 'characterData') localizeText(change.target);
      else if (change.type === 'attributes') localizeElement(change.target);
      else for (const node of change.addedNodes) localizeTree(node);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });

  window.InkballDesktopI18n = {
    get language() { return language; },
    setLanguage(next) {
      language = next === 'en' ? 'en' : 'zh';
      document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
      document.title = language === 'en' ? 'Spherail' : '绘轨';
      localizeTree(document.body);
    },
    translate,
  };
})();

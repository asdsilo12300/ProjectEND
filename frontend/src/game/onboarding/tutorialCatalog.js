export const TUTORIAL_VERSION = 4

export const tutorialCatalog = {
  lab: {
    page: 'lab',
    icon: 'controller',
    label: { en: 'Start growing', th: 'เริ่มปลูกพืช' },
    eyebrow: { en: 'Plant Lab basics', th: 'พื้นฐาน Plant Lab' },
    summary: {
      en: 'Choose a growing mode and plant, read its condition, adjust the environment, and complete a growing cycle.',
      th: 'เลือกโหมดและชนิดพืช อ่านสถานะ ปรับสภาพแวดล้อม และจบรอบการปลูกอย่างถูกต้อง',
    },
    steps: [
      {
        icon: 'controller',
        targets: ['[data-tour="lab-mode-picker"]', '[data-tour="lab-mode-option"]'],
        requirement: 'lab-mode-selected',
        autoAdvance: true,
        title: { en: 'Choose your growing mode', th: 'เลือกโหมดการปลูก' },
        description: {
          en: 'Start with Environment Control to adjust every factor, or choose Outdoor to use real location, weather, daylight, and rain. Select one of the highlighted mode cards to continue.',
          th: 'เริ่มด้วยโหมดควบคุมปัจจัยเพื่อปรับค่าได้ทั้งหมด หรือเลือกโหมดกลางแจ้งเพื่อใช้ตำแหน่ง อากาศ แสง และฝนจริง กดการ์ดโหมดที่ไฮไลต์เพื่อไปต่อ',
        },
        actionHint: { en: 'Select a growing mode to continue', th: 'กรุณาเลือกโหมดการปลูกเพื่อไปต่อ' },
      },
      {
        icon: 'plant',
        targets: ['[data-tour="lab-plant-card"]', '[data-tour="lab-plants"]', '[data-tour="lab-assets"]', '.lab-library-toggle'],
        requirement: 'lab-plant-selected',
        autoAdvance: true,
        title: { en: 'Choose your first plant', th: 'เลือกพืชต้นแรก' },
        description: {
          en: 'Open Plants in Lab assets and select a species marked Ready. Each species keeps its own growing mode, environment, and progress.',
          th: 'เปิดหมวดพืชในอุปกรณ์ห้องทดลอง แล้วเลือกพืชที่มีสถานะพร้อม พืชแต่ละชนิดจะเก็บโหมด สภาพแวดล้อม และความคืบหน้าแยกจากกัน',
        },
        actionHint: { en: 'Select a plant marked Ready to continue', th: 'เลือกพืชที่มีสถานะพร้อมเพื่อไปต่อ' },
      },
      {
        icon: 'help',
        targets: ['[data-tour="lab-plant-knowledge"]', '[data-tour="lab-plant-guide-button"]', '[data-tour="lab-plant-card"]'],
        requirement: 'lab-knowledge-viewed',
        autoAdvance: true,
        title: { en: 'Read the plant guide', th: 'อ่านข้อมูลความรู้ของพืช' },
        description: {
          en: 'After planting starts, review the scientific name, real-life growth time, healthy factor ranges, care instructions, photo, and trusted references. Close the guide when you understand the plant.',
          th: 'หลังเริ่มปลูก ให้อ่านชื่อวิทยาศาสตร์ ระยะเติบโตจริง ช่วงปัจจัยที่เหมาะสม วิธีดูแล รูปภาพ และแหล่งอ้างอิงที่น่าเชื่อถือ แล้วปิดหน้าความรู้เมื่ออ่านเสร็จ',
        },
        actionHint: { en: 'Read and close the plant guide to continue', th: 'อ่านและปิดหน้าความรู้ของพืชเพื่อไปต่อ' },
      },
      {
        icon: 'controller',
        targets: ['[data-tour="lab-stage"]'],
        title: { en: 'Inspect the live 3D scene', th: 'สังเกตฉาก 3D แบบเรียลไทม์' },
        description: {
          en: 'The model shows the selected species, growth stage, time-of-day lighting, pests, fungus, and the current plant condition.',
          th: 'โมเดลจะแสดงชนิดพืช ระยะเติบโต แสงตามช่วงเวลา ศัตรูพืช เชื้อรา และสภาพของพืชในปัจจุบัน',
        },
      },
      {
        icon: 'speed',
        targets: ['[data-panel-id="monitor"]'],
        title: { en: 'Read Plant Monitor before acting', th: 'อ่าน Plant Monitor ก่อนตัดสินใจ' },
        description: {
          en: 'Check health, growth, pace, the real-life growth calculation, pest percentages, and Recommended next action.',
          th: 'ตรวจสุขภาพ การเติบโต ความเร็ว กราฟเทียบเวลาจริง เปอร์เซ็นต์ศัตรูพืช และคำแนะนำรอบถัดไป',
        },
      },
      {
        icon: 'settings',
        targets: ['[data-panel-id="climate"]', '[data-tour="mobile-panel-dock"]'],
        title: { en: 'Preview, confirm, then watch the action', th: 'ตรวจค่า ยืนยัน แล้วดูแอนิเมชัน' },
        description: {
          en: 'In Environment Control, slider changes are only a preview. Confirm them to play the 3D action; the server changes the real values only after the animation reaches Apply.',
          th: 'ในโหมดควบคุมปัจจัย ค่า Slider เป็นเพียงตัวอย่าง ต้องกดยืนยันเพื่อเล่นแอนิเมชัน 3D และ Server จะเปลี่ยนค่าจริงเมื่อแอนิเมชันถึงจุดใช้งานแล้วเท่านั้น',
        },
      },
      {
        icon: 'location',
        targets: ['[data-panel-id="climate"]', '[data-tour="mobile-panel-dock"]'],
        title: { en: 'Outdoor weather belongs to the saved plant', th: 'อากาศกลางแจ้งผูกกับพืชที่บันทึก' },
        description: {
          en: 'Outdoor mode uses the plant’s saved location for weather, daylight, and rain. Transfer location with GPS, search, or the map; growth progress stays unchanged and the new weather starts next cycle.',
          th: 'โหมดกลางแจ้งใช้อากาศ แสง และฝนจากตำแหน่งที่บันทึกกับต้นพืช ย้ายสถานที่ได้ด้วย GPS การค้นหา หรือแผนที่ โดยความคืบหน้าไม่หายและอากาศใหม่เริ่มใช้รอบถัดไป',
        },
      },
      {
        icon: 'tool',
        targets: ['[data-tour="lab-items"]', '[data-panel-id="monitor"]', '[data-tour="lab-assets"]'],
        title: { en: 'Match plant-care items to the problem', th: 'เลือกไอเทมให้ตรงกับปัญหา' },
        description: {
          en: 'Use Insect Spray for aphids, Snail Spray for snails, Fungus Spray for fungus, or Hand Pick for supported pests. Check Pest monitoring before consuming an item.',
          th: 'ใช้สเปรย์กำจัดแมลงกับเพลี้ย สเปรย์กำจัดหอยกับหอยทาก สเปรย์กำจัดเชื้อรากับเชื้อรา หรือเก็บด้วยมือกับศัตรูพืชที่รองรับ โดยตรวจตัวติดตามศัตรูพืชก่อนใช้ไอเทม',
        },
      },
      {
        icon: 'clock',
        targets: ['[data-panel-id="monitor"]', '[data-tour="lab-items"]'],
        title: { en: 'Respond to naturally scheduled events', th: 'รับมือเหตุการณ์ที่เกิดตามธรรมชาติ' },
        description: {
          en: 'Important events appear as a centered alert and recommend a matching item. New players receive a grace period; harmful events have cooldowns and never stack more than one at a time.',
          th: 'เหตุการณ์สำคัญจะแจ้งกลางจอพร้อมแนะนำไอเทมรับมือ ผู้เล่นใหม่มีช่วงปลอดภัย เหตุการณ์อันตรายมี Cooldown และจะไม่เกิดซ้อนกันเกินหนึ่งรายการ',
        },
      },
      {
        icon: 'save',
        targets: ['[data-tour="lab-actions"]'],
        title: { en: 'Harvest or uproot intentionally', th: 'เลือกเก็บเกี่ยวหรือถอนต้นอย่างเหมาะสม' },
        description: {
          en: 'Harvest becomes available at maturity and saves the full calculation to History. Uproot ends the active plant without a harvest result.',
          th: 'เมื่อโตเต็มที่จะเก็บเกี่ยวและบันทึกผลคำนวณทั้งหมดไป History ส่วนถอนต้นใช้จบรอบโดยไม่มีผลเก็บเกี่ยว',
        },
      },
    ],
  },
  'lab-items': {
    page: 'lab',
    icon: 'tool',
    label: { en: 'Use plant-care items', th: 'ใช้ไอเทมดูแลพืช' },
    eyebrow: { en: 'Inventory and treatment', th: 'คลังไอเทมและการรักษา' },
    summary: {
      en: 'Diagnose a problem, select the matching treatment, apply it to the plant, and understand inventory quantities.',
      th: 'วิเคราะห์ปัญหา เลือกอุปกรณ์ให้ตรงสาเหตุ ใช้กับต้นพืช และเข้าใจจำนวนไอเทมคงเหลือ',
    },
    steps: [
      {
        icon: 'pest',
        targets: ['[data-panel-id="monitor"]'],
        title: { en: 'Diagnose before selecting a tool', th: 'วิเคราะห์ปัญหาก่อนเลือกอุปกรณ์' },
        description: {
          en: 'Read Pest monitoring and Recommended next action. Aphids, snails, and fungus require different treatments.',
          th: 'ดู Pest monitoring และ Recommended next action เพราะเพลี้ย หอยทาก และเชื้อราต้องใช้อุปกรณ์คนละชนิด',
        },
      },
      {
        icon: 'shop',
        targets: ['[data-tour="lab-items"]', '[data-tour="lab-assets"]', '.lab-library-toggle'],
        title: { en: 'Open Items in Lab assets', th: 'เปิดหมวด Items ใน Lab assets' },
        description: {
          en: 'The quantity badge shows what you own. An out-of-stock item is disabled and must be purchased from Shop.',
          th: 'ป้ายจำนวนบอกของที่มีอยู่ ไอเทมที่หมดจะกดไม่ได้และต้องซื้อเพิ่มจากหน้า Shop',
        },
      },
      {
        icon: 'tool',
        targets: ['[data-tour="lab-items"]', '.lab-library-toggle', '[data-tour="lab-stage"]'],
        title: { en: 'Select the matching treatment', th: 'เลือกไอเทมให้ตรงกับปัญหา' },
        description: {
          en: 'Insect Spray treats aphids, Snail Spray treats snails, Fungus Spray treats fungus, and Hand Pick handles aphids or snails.',
          th: 'Insect Spray ใช้กับเพลี้ย, Snail Spray ใช้กับหอย, Fungus Spray ใช้กับเชื้อรา และ Hand Pick ใช้กับเพลี้ยหรือหอย',
        },
      },
      {
        icon: 'mouse',
        targets: ['[data-tour="lab-stage"]'],
        title: { en: 'Click the plant to apply the selected item', th: 'คลิกต้นพืชเพื่อใช้ไอเทมที่เลือก' },
        description: {
          en: 'After selecting an item, click the plant once. The action moves through targeting, animation, apply, and success; the centered result and refreshed monitor appear after the server accepts it.',
          th: 'หลังเลือกไอเทมให้คลิกต้นพืชหนึ่งครั้ง ระบบจะทำงานตามลำดับ เล็งเป้าหมาย เล่นแอนิเมชัน ใช้งาน และสำเร็จ จากนั้นจึงแสดงผลกลางจอและอัปเดต Monitor หลัง Server ยอมรับ',
        },
      },
      {
        icon: 'warning',
        targets: ['[data-tour="lab-items"]', '.lab-library-toggle', '[data-panel-id="monitor"]'],
        title: { en: 'Use items only when needed', th: 'ใช้ไอเทมเมื่อจำเป็นเท่านั้น' },
        description: {
          en: 'A successful server response consumes one item. Repeated clicks use the same action id and cannot charge twice; a failed or mismatched treatment does not consume inventory.',
          th: 'ระบบจะหักหนึ่งชิ้นเมื่อ Server ยืนยันสำเร็จเท่านั้น การกดซ้ำด้วย Action เดิมจะไม่หักซ้ำ และหากล้มเหลวหรือเลือกการรักษาไม่ตรงจะไม่เสียไอเทม',
        },
      },
    ],
  },
  'lab-friends': {
    page: 'lab',
    icon: 'groups',
    label: { en: 'Friends and garden pranks', th: 'เพื่อนและการแกล้งสวน' },
    eyebrow: { en: 'Social Plant Lab', th: 'ระบบเพื่อนใน Plant Lab' },
    summary: {
      en: 'Add classmates, visit a planted species, leave observations, and use aphid or snail prank items safely.',
      th: 'เพิ่มเพื่อน เยี่ยมพืชที่เพื่อนปลูก แสดงความคิดเห็น และใช้ไอเทมเพลี้ยหรือหอยแกล้งเพื่อนได้อย่างถูกต้อง',
    },
    steps: [
      {
        icon: 'groups',
        targets: ['[data-panel-id="friends"]', '[data-tour="mobile-panel-dock"]'],
        title: { en: 'Find, invite, and manage friends', th: 'ค้นหา เชิญ และจัดการเพื่อน' },
        description: {
          en: 'Use Invite to search users, Requests to accept invitations, Online to see active friends, and View to enter a garden.',
          th: 'ใช้ Invite ค้นหาผู้ใช้, Requests รับคำขอ, Online ดูเพื่อนที่ออนไลน์ และ View เพื่อเข้าสวนของเพื่อน',
        },
      },
      {
        icon: 'eye',
        targets: ['[data-panel-id="friends"]', '[data-tour="lab-stage"]'],
        title: { en: 'Choose a planted species to view', th: 'เลือกดูเฉพาะพืชที่เพื่อนปลูก' },
        description: {
          en: 'The Plants list marks which species are planted. Unplanted species stay disabled, and an empty garden shows a clear status message.',
          th: 'รายการ Plants บอกว่าชนิดใดปลูกอยู่ ชนิดที่ยังไม่ปลูกจะกดไม่ได้ และสวนว่างจะแสดงข้อความแจ้งกลางหน้าจอ',
        },
      },
      {
        icon: 'chat',
        targets: ['[data-panel-id="comments"]', '[data-tour="mobile-panel-dock"]'],
        title: { en: 'Leave an observation on that plant', th: 'แสดงความคิดเห็นกับพืชต้นนั้น' },
        description: {
          en: 'Friend comments are tied to the selected simulation. Your avatar appears on your comment and each friend keeps their own avatar.',
          th: 'ความคิดเห็นจะผูกกับพืชที่เลือก รูปโปรไฟล์ของคุณจะแสดงในข้อความของคุณ และของเพื่อนจะแสดงตามบัญชีผู้เขียน',
        },
      },
      {
        icon: 'bug',
        targets: ['[data-tour="lab-items"]', '[data-tour="lab-assets"]', '.lab-library-toggle'],
        title: { en: 'Select Aphid Prank or Snail Prank', th: 'เลือก Aphid Prank หรือ Snail Prank' },
        description: {
          en: 'Only friend-prank items are available in view-only mode. They cost coins in Shop and must have inventory remaining.',
          th: 'เมื่อดูสวนเพื่อนจะใช้ได้เฉพาะไอเทมแกล้งเพื่อน ต้องซื้อจาก Shop ด้วยเหรียญและต้องมีจำนวนคงเหลือ',
        },
      },
      {
        icon: 'mouse',
        targets: ['[data-tour="lab-stage"]'],
        title: { en: 'Click the friend plant and confirm', th: 'คลิกพืชของเพื่อนแล้วกดยืนยัน' },
        description: {
          en: 'Click the planted model after choosing a prank. Confirm the dialog to consume one item and send a danger notification to your friend.',
          th: 'หลังเลือกไอเทมให้คลิกโมเดลพืชและยืนยัน ระบบจะหักหนึ่งชิ้น พร้อมส่งการแจ้งเตือนอันตรายไปหาเพื่อน',
        },
      },
      {
        icon: 'arrowBack',
        targets: ['[data-tour="friend-mode-banner"]', '[data-tour="lab-stage"]'],
        title: { en: 'Return without changing their garden', th: 'กลับสวนตนเองโดยไม่แก้ข้อมูลเพื่อน' },
        description: {
          en: 'Friend gardens are view-only except comments and prank actions. Use Back to my garden when finished.',
          th: 'สวนเพื่อนเป็นโหมดดูอย่างเดียว ยกเว้นความคิดเห็นและการแกล้ง เมื่อเสร็จให้กด Back to my garden',
        },
      },
    ],
  },
  navigation: {
    page: 'lab',
    icon: 'notifications',
    label: { en: 'Navigation and notifications', th: 'เมนูและการแจ้งเตือน' },
    eyebrow: { en: 'Always available', th: 'เครื่องมือที่ใช้ได้ทุกหน้า' },
    summary: {
      en: 'Move between user pages, understand coins and alerts, manage your profile, and reopen the Help Center.',
      th: 'สลับหน้าผู้ใช้ ตรวจเหรียญและแจ้งเตือน จัดการโปรไฟล์ และเปิดศูนย์ช่วยเหลืออีกครั้ง',
    },
    steps: [
      {
        icon: 'controller',
        targets: ['[data-tour="global-navigation"]', '[data-tour="global-topbar"]'],
        title: { en: 'Use the main navigation', th: 'ใช้เมนูนำทางหลัก' },
        description: {
          en: 'Move between Home, Learn, Plant Lab, Shop, History, and Community. On smaller screens, open the navigation menu button.',
          th: 'สลับระหว่าง Home, Learn, Plant Lab, Shop, History และ Community ส่วนหน้าจอเล็กให้เปิดปุ่มเมนูนำทาง',
        },
      },
      {
        icon: 'notifications',
        targets: ['[data-tour="global-notifications"]'],
        title: { en: 'The bell combines important alerts', th: 'กระดิ่งรวมแจ้งเตือนสำคัญ' },
        description: {
          en: 'It combines garden, game, and Community updates. A red badge is unread; plant-danger alerts also show a red warning icon.',
          th: 'รวมแจ้งเตือนสวน เกม และ Community ป้ายแดงคือรายการที่ยังไม่อ่าน ส่วนอันตรายต่อพืชจะมีไอคอนเตือนสีแดง',
        },
      },
      {
        icon: 'shop',
        targets: ['[data-tour="global-coins"]'],
        title: { en: 'Track your coin balance', th: 'ติดตามจำนวนเหรียญ' },
        description: {
          en: 'Coins are earned from game progress and spent in Shop. A small animation confirms rewards and purchase deductions.',
          th: 'ได้รับเหรียญจากความก้าวหน้าในเกมและใช้ซื้อของใน Shop โดยมีแอนิเมชันแจ้งเมื่อได้รับหรือถูกหัก',
        },
      },
      {
        icon: 'person',
        targets: ['[data-tour="global-profile"]'],
        title: { en: 'Open account actions from your profile', th: 'เปิดคำสั่งบัญชีจากเมนูโปรไฟล์' },
        description: {
          en: 'Review level and EXP, open Settings, access the admin console when authorized, or log out securely.',
          th: 'ดูระดับและ EXP เปิด Settings เข้า Admin console เมื่อมีสิทธิ์ หรือออกจากระบบอย่างปลอดภัย',
        },
      },
      {
        icon: 'help',
        targets: ['[data-tour="help-button"]', '[data-tour="global-topbar"]'],
        title: { en: 'Choose a guide instead of repeating everything', th: 'เลือกดูเฉพาะคู่มือที่ต้องการ' },
        description: {
          en: 'Open Help & tutorials at any time. Each topic remembers its own completion status, so you can replay only what you need.',
          th: 'เปิด Help & tutorials ได้ทุกเมื่อ แต่ละหัวข้อจำสถานะแยกกัน จึงเลือกดูซ้ำเฉพาะเรื่องที่ต้องการได้',
        },
      },
    ],
  },
  shop: {
    page: 'shop',
    icon: 'shop',
    label: { en: 'Shop and inventory', th: 'ร้านค้าและคลังไอเทม' },
    eyebrow: { en: 'Spend coins wisely', th: 'ใช้เหรียญอย่างคุ้มค่า' },
    summary: {
      en: 'Search products, compare treatment and prank items, purchase safely, and find them in Plant Lab.',
      th: 'ค้นหาสินค้า เปรียบเทียบไอเทมรักษาและไอเทมแกล้งเพื่อน ซื้ออย่างปลอดภัย และนำไปใช้ใน Plant Lab',
    },
    steps: [
      {
        icon: 'shop',
        targets: ['[data-tour="shop-header"]'],
        title: { en: 'Check your balance and catalog', th: 'ตรวจเหรียญและภาพรวมสินค้า' },
        description: {
          en: 'Your coin balance updates after a purchase. Product cards show purpose, price, availability, and the Buy action.',
          th: 'จำนวนเหรียญจะอัปเดตหลังซื้อ การ์ดสินค้าบอกประเภท ราคา สถานะ และปุ่ม Buy',
        },
      },
      {
        icon: 'search',
        targets: ['[data-tour="shop-filters"]'],
        title: { en: 'Filter before browsing', th: 'ใช้ตัวกรองก่อนเลือกซื้อ' },
        description: {
          en: 'Search by name, choose a category, set a price limit, and change sorting to narrow the catalog.',
          th: 'ค้นหาจากชื่อ เลือกหมวด กำหนดราคาสูงสุด และเปลี่ยนลำดับเพื่อให้เจอสินค้าง่ายขึ้น',
        },
      },
      {
        icon: 'tool',
        targets: ['[data-tour="shop-catalog"]'],
        title: { en: 'Separate treatments from pranks', th: 'แยกไอเทมรักษากับไอเทมแกล้งเพื่อน' },
        description: {
          en: 'Lab items treat your own plant. Friend Prank items add aphids or snails only when visiting a friend garden.',
          th: 'Lab item ใช้รักษาพืชตนเอง ส่วน Friend Prank ใช้เพิ่มเพลี้ยหรือหอยเมื่อเข้าไปสวนเพื่อนเท่านั้น',
        },
      },
      {
        icon: 'shoppingCart',
        targets: ['[data-tour="shop-catalog"]'],
        title: { en: 'Confirm the purchase and use it in Lab assets', th: 'ยืนยันการซื้อแล้วใช้จาก Lab assets' },
        description: {
          en: 'A successful purchase adds quantity to your inventory immediately. Return to Plant Lab and open Items to use it.',
          th: 'ซื้อสำเร็จแล้วจำนวนจะเข้า Inventory ทันที กลับ Plant Lab และเปิดหมวด Items เพื่อใช้งาน',
        },
      },
    ],
  },
  history: {
    page: 'history',
    icon: 'history',
    label: { en: 'Saved experiments', th: 'ประวัติการทดลอง' },
    eyebrow: { en: 'Evidence and reflection', th: 'หลักฐานและการทบทวนผล' },
    summary: {
      en: 'Search completed experiments, inspect calculations, replay saved game states, and control Community sharing.',
      th: 'ค้นหาผลการปลูก ตรวจการคำนวณ เปิดสถานะเกมที่บันทึก และควบคุมการแชร์ไป Community',
    },
    steps: [
      {
        icon: 'history',
        targets: ['[data-tour="history-header"]'],
        title: { en: 'Review every harvested result', th: 'ทบทวนผลการเก็บเกี่ยวทั้งหมด' },
        description: {
          en: 'History records plant, stage, score, health, actual play duration, and real-life growth equivalent at save time.',
          th: 'History เก็บชนิดพืช ระยะ คะแนน สุขภาพ เวลาเล่นจริง และเวลาเติบโตเทียบชีวิตจริง ณ ตอนบันทึก',
        },
      },
      {
        icon: 'search',
        targets: ['[data-tour="history-search"]'],
        title: { en: 'Find a specific experiment', th: 'ค้นหาการทดลองที่ต้องการ' },
        description: {
          en: 'Search by plant, stage, analysis, or result. Pagination helps when many records have accumulated.',
          th: 'ค้นหาจากชื่อพืช ระยะ บทวิเคราะห์ หรือผลลัพธ์ และใช้ Pagination เมื่อมีข้อมูลจำนวนมาก',
        },
      },
      {
        icon: 'eye',
        targets: ['[data-tour="history-card"]', '[data-tour="history-records"]'],
        title: { en: 'Open the detailed calculation', th: 'เปิดดูรายละเอียดการคำนวณ' },
        description: {
          en: 'Select a card to inspect analysis, next direction, growth graph, factor summary, and the saved 3D state.',
          th: 'เลือกการ์ดเพื่อดูบทวิเคราะห์ แนวทางถัดไป กราฟการเติบโต สรุปปัจจัย และสถานะ 3D ที่บันทึกไว้',
        },
      },
      {
        icon: 'share',
        targets: ['[data-tour="history-share"]', '[data-tour="history-records"]'],
        title: { en: 'Choose private or shared', th: 'เลือกเก็บส่วนตัวหรือแชร์' },
        description: {
          en: 'Turn sharing on to create a Community post with the snapshot and growth calculation. Turn it off to remove public visibility.',
          th: 'เปิดการแชร์เพื่อสร้างโพสต์ Community พร้อมภาพและข้อมูลคำนวณ หรือปิดเพื่อหยุดการแสดงแบบสาธารณะ',
        },
      },
      {
        icon: 'trash',
        targets: ['[data-tour="history-records"]'],
        title: { en: 'Delete only after confirmation', th: 'ลบเมื่อแน่ใจและยืนยันแล้ว' },
        description: {
          en: 'The delete action opens a confirmation dialog so a saved experiment is not removed accidentally.',
          th: 'ปุ่มลบจะแสดงหน้าต่างยืนยันก่อนเสมอ เพื่อป้องกันการลบผลการทดลองโดยไม่ตั้งใจ',
        },
      },
    ],
  },
  community: {
    page: 'community',
    icon: 'groups',
    label: { en: 'Community', th: 'ชุมชน' },
    eyebrow: { en: 'Share and interact', th: 'แบ่งปันและมีส่วนร่วม' },
    summary: {
      en: 'Browse shared results, react and discuss, open saved games, find people, manage your profile, and review social notifications.',
      th: 'ดูผลที่แชร์ กดใจและสนทนา เปิดเกมที่บันทึก ค้นหาผู้ใช้ จัดการโปรไฟล์ และตรวจแจ้งเตือนของชุมชน',
    },
    steps: [
      {
        icon: 'home',
        targets: ['[data-tour="community-navigation"]', '[data-tour="community-mobile-navigation"]'],
        title: { en: 'Move between Community sections', th: 'สลับส่วนต่าง ๆ ของ Community' },
        description: {
          en: 'Home keeps your feed position, Profile shows posts and account details, Search finds users, and Notifications lists social activity.',
          th: 'Home จำตำแหน่ง Feed, Profile แสดงข้อมูลและโพสต์, Search ค้นหาผู้ใช้ และ Notifications แสดงกิจกรรมทางสังคม',
        },
      },
      {
        icon: 'groups',
        targets: ['[data-tour="community-feed"]'],
        title: { en: 'Choose For you or Friends', th: 'เลือก For you หรือ Friends' },
        description: {
          en: 'For you shows public shared experiments. Friends narrows the feed to connected classmates.',
          th: 'For you แสดงผลการปลูกสาธารณะ ส่วน Friends แสดงเฉพาะโพสต์จากเพื่อนที่เชื่อมต่อแล้ว',
        },
      },
      {
        icon: 'heart',
        targets: ['[data-tour="community-post-actions"]', '[data-tour="community-feed"]'],
        title: { en: 'React, comment, reply, and like comments', th: 'กดใจ แสดงความคิดเห็น ตอบกลับ และถูกใจความคิดเห็น' },
        description: {
          en: 'Open a post to join its discussion. Reactions update immediately and notifications are sent to the relevant author.',
          th: 'เปิดโพสต์เพื่อร่วมสนทนา การกดใจจะอัปเดตทันที และระบบส่งแจ้งเตือนไปยังเจ้าของเนื้อหาที่เกี่ยวข้อง',
        },
      },
      {
        icon: 'eye',
        targets: ['[data-tour="community-feed"]'],
        title: { en: 'Open the shared game state', th: 'เปิดดูสถานะเกมที่แชร์' },
        description: {
          en: 'Open saved game state enters a view-only 3D replay. Back returns to Community at the same feed position.',
          th: 'Open saved game state จะเปิดฉาก 3D แบบดูอย่างเดียว และปุ่ม Back จะกลับ Community ที่ตำแหน่ง Feed เดิม',
        },
      },
      {
        icon: 'person',
        targets: ['[data-tour="community-profile-preview"]', '[data-tour="community-dashboard"]', '[data-tour="community-feed"]'],
        title: { en: 'Preview and open profiles', th: 'ดูตัวอย่างและเปิดโปรไฟล์' },
        description: {
          en: 'Hover a name or ranking to preview profile and cover details. Select it to open the full profile or send a friend request.',
          th: 'วางเมาส์บนชื่อหรืออันดับเพื่อดูโปรไฟล์ย่อ แล้วเลือกเพื่อเปิดโปรไฟล์เต็มหรือส่งคำขอเป็นเพื่อน',
        },
      },
      {
        icon: 'notifications',
        targets: ['[data-tour="community-navigation"]', '[data-tour="community-mobile-navigation"]'],
        title: { en: 'Read Community notifications here', th: 'อ่านแจ้งเตือน Community ในหน้านี้' },
        description: {
          en: 'Likes, comments, comment likes, and replies stay in Community Notifications. Opening an item marks it read and takes you to its context.',
          th: 'การกดใจ คอมเมนต์ ถูกใจคอมเมนต์ และตอบกลับจะอยู่ใน Community Notifications เมื่อเปิดรายการจะอ่านแล้วและไปยังเนื้อหาที่เกี่ยวข้อง',
        },
      },
      {
        icon: 'speed',
        targets: ['[data-tour="community-insights"]', '[data-tour="community-navigation"]'],
        title: { en: 'Review your private Community insights', th: 'ตรวจสถิติ Community ส่วนตัว' },
        description: {
          en: 'Your own Profile has a compact, collapsible chart for posts, likes, comments, and replies across 7, 30, or 90 days.',
          th: 'หน้า Profile ของตัวเองมีกราฟแบบพับได้ แสดงโพสต์ ไลก์ คอมเมนต์ และการตอบกลับในช่วง 7, 30 หรือ 90 วัน',
        },
      },
      {
        icon: 'trophy',
        targets: ['[data-tour="community-dashboard"]'],
        title: { en: 'Use rankings for discovery, not just scores', th: 'ใช้อันดับเพื่อค้นหาผู้เล่นและผลงาน' },
        description: {
          en: 'Level ranking reflects progression, while Grow ranking reflects saved plants. Select a user to inspect their profile.',
          th: 'Level ranking แสดงความก้าวหน้า ส่วน Grow ranking แสดงจำนวนพืชที่บันทึก เลือกชื่อเพื่อดูโปรไฟล์ได้',
        },
      },
    ],
  },
  settings: {
    page: 'settings',
    icon: 'settings',
    label: { en: 'Account and preferences', th: 'บัญชีและการตั้งค่า' },
    eyebrow: { en: 'Personal controls', th: 'การควบคุมส่วนบุคคล' },
    summary: {
      en: 'Protect your account and customize accessibility, theme, text size, and language.',
      th: 'รักษาความปลอดภัยบัญชีและปรับการเข้าถึง ธีม ขนาดตัวอักษร และภาษาให้เหมาะกับคุณ',
    },
    steps: [
      {
        icon: 'key',
        targets: ['[data-tour="settings-account"]'],
        title: { en: 'Reset your password with email OTP', th: 'รีเซ็ตรหัสผ่านด้วย OTP ทางอีเมล' },
        description: {
          en: 'Open Reset password, request the one-time code sent to your email, verify it, and then set the new password.',
          th: 'เปิด Reset password ขอรหัสครั้งเดียวที่ส่งเข้าอีเมล ยืนยันรหัส แล้วจึงตั้งรหัสผ่านใหม่',
        },
      },
      {
        icon: 'eye',
        targets: ['[data-tour="settings-accessibility"]'],
        title: { en: 'Set comfortable text size', th: 'ตั้งขนาดตัวอักษรให้อ่านสบาย' },
        description: {
          en: 'Choose the text scale that stays readable without breaking the interface. The preference applies throughout the user system.',
          th: 'เลือกขนาดตัวอักษรที่อ่านง่ายโดยไม่ทำให้ Layout เสีย และระบบจะนำค่านี้ไปใช้กับหน้าผู้ใช้ทั้งหมด',
        },
      },
      {
        icon: 'lightMode',
        targets: ['[data-tour="settings-accessibility"]'],
        title: { en: 'Choose light or dark theme', th: 'เลือกธีมสว่างหรือมืด' },
        description: {
          en: 'Use the appearance controls to match your environment and improve contrast.',
          th: 'ใช้ตัวเลือก Appearance ให้เหมาะกับสภาพแวดล้อมและเพิ่มความชัดเจนในการมองเห็น',
        },
      },
      {
        icon: 'translate',
        targets: ['[data-tour="settings-language"]'],
        title: { en: 'Change the whole user interface language', th: 'เปลี่ยนภาษาของระบบผู้ใช้ทั้งหมด' },
        description: {
          en: 'Switch between English and Thai. Navigation, guides, labels, and supported content update together.',
          th: 'สลับภาษาอังกฤษและไทย เมนู คู่มือ ป้ายกำกับ และเนื้อหาที่รองรับจะเปลี่ยนพร้อมกัน',
        },
      },
      {
        icon: 'help',
        targets: ['[data-tour="help-button"]'],
        title: { en: 'Replay any tutorial whenever needed', th: 'เปิด Tutorial ซ้ำได้ทุกเมื่อ' },
        description: {
          en: 'Use the question-mark button or Help & tutorials in your profile menu to choose a specific guide.',
          th: 'ใช้ปุ่มเครื่องหมายคำถามหรือ Help & tutorials ในเมนูโปรไฟล์เพื่อเลือกคู่มือเฉพาะหัวข้อ',
        },
      },
    ],
  },
}

export const tutorialPageOrder = ['lab', 'lab-items', 'lab-friends', 'navigation', 'shop', 'history', 'community', 'settings']

export const autoGuideByPage = {
  lab: 'lab',
  shop: 'shop',
  history: 'history',
  community: 'community',
  settings: 'settings',
}

export function tutorialText(value, language) {
  return value?.[language] ?? value?.en ?? ''
}

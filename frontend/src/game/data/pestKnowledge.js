import { imageAssets } from './gameData'

const knowledgeByPest = {
  snail: {
    name: { en: 'Snails and slugs', th: 'หอยทากและทาก' },
    shortName: { en: 'Snail', th: 'หอยทาก' },
    scientificName: 'Gastropoda',
    category: { en: 'Chewing pest', th: 'ศัตรูพืชกัดกินใบ' },
    imageUrl: '/pest-knowledge/garden-snail.jpg',
    photo: {
      credit: 'Matthew T Rader',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Baby_Garden_Snail_(Cornu_aspersum).jpg',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    summary: {
      en: 'Snails and slugs usually feed at night or in cool, damp conditions. They scrape tender plant tissue and can damage seedlings quickly.',
      th: 'หอยทากและทากมักออกหากินตอนกลางคืนหรือช่วงที่เย็นและชื้น โดยจะขูดกินเนื้อเยื่ออ่อนของพืชและสร้างความเสียหายกับต้นอ่อนได้รวดเร็ว',
    },
    signs: {
      en: ['Irregular holes with smooth edges on leaves or flowers', 'Silvery slime trails on leaves, soil, or nearby surfaces', 'Young shoots or seedlings clipped close to the ground'],
      th: ['ใบหรือดอกมีรูขอบเรียบและรูปร่างไม่สม่ำเสมอ', 'พบคราบเมือกสีเงินบนใบ ดิน หรือพื้นผิวใกล้เคียง', 'ยอดอ่อนหรือต้นกล้าถูกกัดขาดใกล้ระดับดิน'],
    },
    favorableConditions: {
      en: ['Moist soil and surfaces that remain wet into the night', 'Dense weeds, stones, boards, or debris that provide hiding places', 'Tender seedlings and low-growing foliage'],
      th: ['ดินและพื้นผิวชื้นต่อเนื่องจนถึงช่วงกลางคืน', 'วัชพืช หิน แผ่นไม้ หรือเศษวัสดุที่ใช้เป็นที่หลบซ่อน', 'ต้นกล้าและใบอ่อนที่อยู่ใกล้พื้นดิน'],
    },
    prevention: {
      en: ['Water near sunrise so the surface dries before night.', 'Remove weeds, debris, boards, and other damp hiding places.', 'Inspect plants after dark or early in the morning and remove pests promptly.'],
      th: ['ให้น้ำช่วงเช้าเพื่อให้พื้นผิวแห้งก่อนถึงกลางคืน', 'กำจัดวัชพืช เศษวัสดุ แผ่นไม้ และบริเวณชื้นที่ใช้หลบซ่อน', 'ตรวจต้นไม้หลังมืดหรือเช้าตรู่และกำจัดทันทีเมื่อพบ'],
    },
    treatments: [
      { id: 'snail-spray', name: { en: 'Snail Spray', th: 'สเปรย์กำจัดหอยทาก' }, imageUrl: imageAssets.snailSpray, success: 100, detail: { en: 'Targets active snails in your current plant.', th: 'ใช้กำจัดหอยทากที่กำลังเกาะต้นปัจจุบัน' } },
    ],
    sources: [
      { label: 'UC Statewide IPM — Snails and Slugs', url: 'https://ipm.ucanr.edu/home-and-landscape/snails-and-slugs/' },
    ],
  },
  aphid: {
    name: { en: 'Aphids', th: 'เพลี้ยอ่อน' },
    shortName: { en: 'Aphid', th: 'เพลี้ย' },
    scientificName: 'Aphididae',
    category: { en: 'Sap-feeding insect', th: 'แมลงดูดกินน้ำเลี้ยง' },
    imageUrl: '/pest-knowledge/aphids.jpg',
    photo: {
      credit: 'Willie Luker',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aphid_Farm_(55206291839).jpg',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    summary: {
      en: 'Aphids are small, soft-bodied insects that gather on tender shoots, buds, stems, and the undersides of young leaves to feed on plant sap.',
      th: 'เพลี้ยอ่อนเป็นแมลงตัวเล็กเนื้อนิ่ม มักรวมกลุ่มตามยอดอ่อน ตาดอก ลำต้น และใต้ใบอ่อนเพื่อดูดกินน้ำเลี้ยงของพืช',
    },
    signs: {
      en: ['Clusters of small insects on new growth or under leaves', 'Leaves curl, twist, yellow, or grow poorly when damage is severe', 'Sticky honeydew, ants, or dark sooty mold on nearby surfaces'],
      th: ['พบแมลงตัวเล็กรวมกลุ่มตามยอดอ่อนหรือใต้ใบ', 'ใบม้วน บิด เหลือง หรือพืชโตช้าเมื่อถูกทำลายรุนแรง', 'พบมูลหวานเหนียว มด หรือราดำบนพื้นผิวใกล้เคียง'],
    },
    favorableConditions: {
      en: ['Abundant soft new growth', 'Warm conditions and an unchecked colony', 'Crowded foliage that makes inspection difficult'],
      th: ['พืชมีเนื้อเยื่อและยอดอ่อนจำนวนมาก', 'อากาศอบอุ่นและไม่ได้ควบคุมกลุ่มเพลี้ยตั้งแต่เริ่มพบ', 'ทรงพุ่มแน่นจนตรวจดูใต้ใบได้ยาก'],
    },
    prevention: {
      en: ['Check new shoots and leaf undersides regularly.', 'Isolate and inspect newly introduced plants before placing them nearby.', 'Avoid unnecessary excess fertilizer that encourages very soft growth.'],
      th: ['ตรวจยอดใหม่และใต้ใบอย่างสม่ำเสมอ', 'แยกและตรวจพืชใหม่ก่อนนำมาวางใกล้ต้นอื่น', 'หลีกเลี่ยงการให้ปุ๋ยมากเกินจำเป็นจนเกิดยอดอ่อนจำนวนมาก'],
    },
    treatments: [
      { id: 'insecticide-spray', name: { en: 'Insect Spray', th: 'สเปรย์กำจัดแมลง' }, imageUrl: imageAssets.insecticide, success: 100, detail: { en: 'Targets active aphids in your current plant.', th: 'ใช้กำจัดเพลี้ยที่กำลังเกาะต้นปัจจุบัน' } },
    ],
    sources: [
      { label: 'University of Minnesota Extension — Aphids', url: 'https://extension.umn.edu/yard-and-garden-insects/aphids' },
    ],
  },
  fungus: {
    name: { en: 'Fungal diseases', th: 'โรคพืชจากเชื้อรา' },
    shortName: { en: 'Fungus', th: 'เชื้อรา' },
    scientificName: 'Fungi (multiple pathogens)',
    category: { en: 'Plant disease', th: 'โรคพืช' },
    imageUrl: '/pest-knowledge/powdery-mildew.jpg',
    photo: {
      credit: 'Dmitry Brant',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Powdery_mildew_9.jpg',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    summary: {
      en: '“Fungus” in the simulation represents a group of plant diseases. Prolonged moisture and poor airflow can allow spores to infect leaves, stems, or flowers.',
      th: '“เชื้อรา” ในระบบจำลองหมายถึงกลุ่มโรคพืชหลายชนิด ความชื้นที่ยาวนานและการระบายอากาศไม่ดีอาจทำให้สปอร์เข้าทำลายใบ ลำต้น หรือดอก',
    },
    signs: {
      en: ['White, gray, brown, or dark spots and patches on plant tissue', 'Powdery, fuzzy, or mold-like growth', 'Soft rot, blighted tissue, yellowing, or wilting'],
      th: ['เกิดจุดหรือปื้นสีขาว เทา น้ำตาล หรือดำบนเนื้อเยื่อพืช', 'พบผง เส้นใย หรือคราบที่มีลักษณะคล้ายรา', 'เนื้อเยื่อเน่า นิ่ม แห้งไหม้ เหลือง หรือเหี่ยว'],
    },
    favorableConditions: {
      en: ['Leaves remain wet after overhead watering, rain, or dew', 'High humidity with dense foliage and poor air movement', 'Infected debris or tools that carry spores between plants'],
      th: ['ใบเปียกนานหลังรดน้ำจากด้านบน ฝน หรือน้ำค้าง', 'ความชื้นสูงร่วมกับทรงพุ่มแน่นและอากาศถ่ายเทไม่ดี', 'เศษพืชหรือเครื่องมือปนเปื้อนที่พาสปอร์ไปยังต้นอื่น'],
    },
    prevention: {
      en: ['Water at the base in the morning and keep leaves as dry as possible.', 'Space plants and prune crowded growth to improve airflow.', 'Remove infected tissue when dry and clean tools before using them again.'],
      th: ['ให้น้ำที่โคนในช่วงเช้าและพยายามไม่ให้ใบเปียกนาน', 'เว้นระยะและตัดแต่งทรงพุ่มเพื่อเพิ่มการถ่ายเทอากาศ', 'นำเนื้อเยื่อที่ติดโรคออกขณะแห้งและทำความสะอาดเครื่องมือก่อนใช้ซ้ำ'],
    },
    treatments: [
      { id: 'antifungal-spray', name: { en: 'Fungus Spray', th: 'สเปรย์กำจัดเชื้อรา' }, imageUrl: imageAssets.antifungal, success: 100, detail: { en: 'Targets the active fungal status in the simulation.', th: 'ใช้กำจัดสถานะเชื้อราที่กำลังเกิดในระบบจำลอง' } },
    ],
    sources: [
      { label: 'University of Minnesota Extension — Preventing plant diseases', url: 'https://extension.umn.edu/how/preventing-plant-diseases-garden' },
      { label: 'University of Minnesota Extension — Managing plant diseases', url: 'https://extension.umn.edu/planting-and-growing-guides/managing-plant-diseases-home-garden' },
    ],
  },
}

export function getPestKnowledge(pest, language = 'en') {
  const key = String(pest?.icon ?? pest?.id ?? pest ?? '').toLowerCase()
  const fallbackName = language === 'th'
    ? pest?.name_th || pest?.name_en || pest?.label || key
    : pest?.name_en || pest?.name_th || pest?.label || key
  const managed = pest?.knowledge

  if (managed) {
    const localizeField = (name, fallback = '') => managed[`${name}_${language}`] || managed[`${name}_en`] || managed[`${name}_th`] || fallback
    const localizeList = (name, fallback) => {
      const selected = managed[`${name}_${language}`]
      const alternate = managed[`${name}_en`] || managed[`${name}_th`]
      return Array.isArray(selected) && selected.length ? selected : Array.isArray(alternate) && alternate.length ? alternate : fallback
    }

    return {
      category: localizeField('category', language === 'th' ? 'ศัตรูพืช' : 'Plant pest'),
      favorableConditions: localizeList('favorable_conditions', [language === 'th' ? 'ติดตามกฎความเสี่ยงที่ผู้ดูแลระบบกำหนด' : 'Monitor the risk rules configured by the administrator.']),
      imageUrl: managed.photo_url || pest?.imageUrl || null,
      name: fallbackName,
      photo: managed.photo_url ? {
        sourceUrl: managed.photo_source_url,
      } : null,
      prevention: localizeList('prevention', [language === 'th' ? 'ติดตามพืชอย่างสม่ำเสมอ' : 'Keep monitoring the plant regularly.']),
      scientificName: [managed.scientific_name, managed.family].filter(Boolean).join(' · ') || '—',
      shortName: fallbackName,
      signs: localizeList('signs', [language === 'th' ? 'ตรวจดูความเปลี่ยนแปลงผิดปกติบนพืช' : 'Inspect the plant for unusual changes.']),
      sources: (Array.isArray(managed.sources) ? managed.sources : []).map((source) => ({
        label: source?.[`label_${language}`] || source?.label_en || source?.label_th || source?.url,
        url: source?.url,
      })).filter((source) => source.url),
      summary: localizeField('summary', language === 'th' ? 'ข้อมูลศัตรูพืชที่ผู้ดูแลระบบกำหนด' : 'Pest information configured by the administrator.'),
      treatments: Array.isArray(pest?.treatments) ? pest.treatments : [],
    }
  }

  const knowledge = knowledgeByPest[key] ?? {
    name: { en: pest?.name_en || fallbackName, th: pest?.name_th || fallbackName },
    shortName: { en: pest?.name_en || fallbackName, th: pest?.name_th || fallbackName },
    scientificName: '—',
    category: { en: 'Plant pest', th: 'ศัตรูพืช' },
    imageUrl: pest?.imageUrl || null,
    photo: null,
    summary: {
      en: 'This pest was added by an administrator. Monitor its risk and use the treatment configured for it.',
      th: 'ศัตรูพืชชนิดนี้เพิ่มโดยผู้ดูแลระบบ ควรติดตามความเสี่ยงและใช้วิธีจัดการที่กำหนดไว้',
    },
    signs: {
      en: ['Inspect the plant for new feeding damage or unusual changes.'],
      th: ['ตรวจดูร่องรอยการกัดกินหรือความเปลี่ยนแปลงผิดปกติบนพืช'],
    },
    favorableConditions: {
      en: ['Risk follows the environmental rules configured by the administrator.'],
      th: ['ความเสี่ยงเป็นไปตามกฎสภาพแวดล้อมที่ผู้ดูแลระบบกำหนด'],
    },
    prevention: {
      en: ['Keep monitoring the plant and maintain suitable growing conditions.'],
      th: ['ติดตามพืชอย่างสม่ำเสมอและรักษาสภาพแวดล้อมให้เหมาะสม'],
    },
    treatments: [],
    sources: [],
  }
  const localize = (value) => value?.[language] ?? value?.en ?? value

  return {
    ...knowledge,
    category: localize(knowledge.category),
    favorableConditions: localize(knowledge.favorableConditions),
    name: localize(knowledge.name),
    prevention: localize(knowledge.prevention),
    shortName: localize(knowledge.shortName),
    signs: localize(knowledge.signs),
    summary: localize(knowledge.summary),
    treatments: knowledge.treatments.map((treatment) => ({
      ...treatment,
      detail: localize(treatment.detail),
      name: localize(treatment.name),
    })),
  }
}

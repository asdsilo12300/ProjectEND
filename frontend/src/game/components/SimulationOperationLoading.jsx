import { AppIcon } from '../icons/FontAwesomeIcon'
import './SimulationOperationLoading.css'

const operationCopy = {
  uproot: {
    icon: 'uproot',
    title: { en: 'Ending this plant simulation', th: 'กำลังสิ้นสุดการจำลองของพืชต้นนี้' },
    description: {
      en: 'The system is safely closing the active plant before preparing the next growing space.',
      th: 'ระบบกำลังสิ้นสุดการปลูกอย่างปลอดภัยก่อนเตรียมพื้นที่สำหรับพืชต้นถัดไป',
    },
    steps: [
      { en: 'Checking the active simulation', th: 'ตรวจสอบรอบจำลองปัจจุบัน' },
      { en: 'Confirming the uproot with the server', th: 'ยืนยันการถอนต้นกับระบบ' },
      { en: 'Preparing the next growing space', th: 'เตรียมพื้นที่สำหรับพืชต้นถัดไป' },
    ],
  },
  harvest: {
    icon: 'harvest',
    title: { en: 'Saving the harvest result', th: 'กำลังบันทึกผลการเก็บเกี่ยว' },
    description: {
      en: 'The final plant state, growth calculation, and visual evidence are being saved to History.',
      th: 'ระบบกำลังบันทึกสถานะสุดท้าย การคำนวณการเติบโต และภาพผลลัพธ์ลงในประวัติ',
    },
    steps: [
      { en: 'Capturing the final simulation state', th: 'บันทึกภาพและสถานะสุดท้าย' },
      { en: 'Synchronizing the latest plant data', th: 'ซิงค์ข้อมูลพืชล่าสุด' },
      { en: 'Creating the harvest history record', th: 'สร้างบันทึกประวัติการเก็บเกี่ยว' },
      { en: 'Preparing the result summary', th: 'เตรียมสรุปผลการจำลอง' },
    ],
  },
  share: {
    icon: 'share',
    title: { en: 'Publishing the live simulation', th: 'กำลังเผยแพร่หน้าจำลองแบบสด' },
    description: {
      en: 'A current preview and viewing permission are being prepared for Community.',
      th: 'ระบบกำลังเตรียมภาพตัวอย่างและสิทธิ์การเข้าชมสำหรับหน้า Community',
    },
    steps: [
      { en: 'Capturing the current simulation', th: 'บันทึกภาพสถานะปัจจุบัน' },
      { en: 'Updating viewing permission', th: 'อัปเดตสิทธิ์การมองเห็น' },
      { en: 'Publishing to Community', th: 'เผยแพร่ไปยัง Community' },
    ],
  },
  unshare: {
    icon: 'eyeOff',
    title: { en: 'Removing the live simulation', th: 'กำลังหยุดแชร์หน้าจำลองแบบสด' },
    description: {
      en: 'The simulation remains saved, but it will no longer be visible in Community.',
      th: 'ข้อมูลจำลองยังคงถูกบันทึกไว้ แต่จะไม่แสดงในหน้า Community อีกต่อไป',
    },
    steps: [
      { en: 'Checking the shared simulation', th: 'ตรวจสอบหน้าจำลองที่แชร์อยู่' },
      { en: 'Updating viewing permission', th: 'อัปเดตสิทธิ์การมองเห็น' },
      { en: 'Removing it from Community', th: 'นำหน้าจำลองออกจาก Community' },
    ],
  },
}

export function SimulationOperationLoading({ language = 'en', operation }) {
  if (!operation) return null

  const locale = language === 'th' ? 'th' : 'en'
  const content = operationCopy[operation.type] ?? operationCopy.harvest
  const activeStep = Math.min(content.steps.length - 1, Math.max(0, Number(operation.step) || 0))
  const progress = Math.round(((activeStep + 1) / content.steps.length) * 100)

  return (
    <section
      className="simulation-operation-loader"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={content.title[locale]}
    >
      <div className="simulation-operation-loader__backdrop" />
      <div className="simulation-operation-loader__card">
        <div className="simulation-operation-loader__header">
          <span className="simulation-operation-loader__icon" aria-hidden="true">
            <AppIcon name={content.icon} />
          </span>
          <div>
            <span className="simulation-operation-loader__eyebrow">
              {locale === 'th' ? 'กำลังดำเนินการ' : 'SIMULATION IN PROGRESS'}
            </span>
            <h2>{content.title[locale]}</h2>
          </div>
        </div>

        <p className="simulation-operation-loader__description">{content.description[locale]}</p>

        <div className="simulation-operation-loader__progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="simulation-operation-loader__progress-copy">
          <strong>{content.steps[activeStep][locale]}</strong>
          <span>{locale === 'th' ? `ขั้นตอน ${activeStep + 1} จาก ${content.steps.length}` : `Step ${activeStep + 1} of ${content.steps.length}`}</span>
        </div>

        <ol className="simulation-operation-loader__steps">
          {content.steps.map((step, index) => {
            const state = index < activeStep ? 'complete' : index === activeStep ? 'active' : 'pending'
            return (
              <li data-state={state} key={step.en}>
                <span className="simulation-operation-loader__step-icon" aria-hidden="true">
                  {state === 'complete' ? <AppIcon name="check" /> : index + 1}
                </span>
                <span>{step[locale]}</span>
                {state === 'active' && <i aria-hidden="true" />}
              </li>
            )
          })}
        </ol>

        <p className="simulation-operation-loader__notice">
          <AppIcon name="clock" />
          {locale === 'th'
            ? 'โปรดรอจนกว่าขั้นตอนจะเสร็จ เพื่อป้องกันข้อมูลซ้ำหรือข้อมูลไม่ครบ'
            : 'Please keep this page open until the operation finishes.'}
        </p>
      </div>
    </section>
  )
}

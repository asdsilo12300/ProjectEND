<?php

namespace App\Services;

use App\Models\Pest;
use App\Models\PestKnowledge;

class PestKnowledgeProfileService
{
    public function syncCoreIfMissing(): void
    {
        foreach ($this->profiles() as $pestName => $profile) {
            $pest = Pest::query()->whereRaw('LOWER(name_en) = ?', [$pestName])->first();
            if (! $pest) {
                continue;
            }

            $knowledge = PestKnowledge::withTrashed()->firstOrNew(['pest_id' => $pest->id]);
            if ($knowledge->exists && ! $knowledge->trashed()) {
                continue;
            }

            $knowledge->fill($profile + ['pest_id' => $pest->id]);
            $knowledge->deleted_at = null;
            $knowledge->save();
        }
    }

    /** @return array<string, array<string, mixed>> */
    private function profiles(): array
    {
        return [
            'aphid' => [
                'family' => 'Aphididae',
                'category_en' => 'Sap-feeding insect',
                'category_th' => 'แมลงดูดกินน้ำเลี้ยง',
                'summary_en' => 'Aphids are small, soft-bodied insects that gather on tender shoots, buds, stems, and the undersides of young leaves to feed on plant sap.',
                'summary_th' => 'เพลี้ยอ่อนเป็นแมลงตัวเล็กเนื้อนิ่ม มักรวมกลุ่มตามยอดอ่อน ตาดอก ลำต้น และใต้ใบอ่อนเพื่อดูดกินน้ำเลี้ยงของพืช',
                'signs_en' => ['Clusters of small insects on new growth or under leaves', 'Leaves curl, twist, yellow, or grow poorly when damage is severe', 'Sticky honeydew, ants, or dark sooty mold on nearby surfaces'],
                'signs_th' => ['พบแมลงตัวเล็กรวมกลุ่มตามยอดอ่อนหรือใต้ใบ', 'ใบม้วน บิด เหลือง หรือพืชโตช้าเมื่อถูกทำลายรุนแรง', 'พบมูลหวานเหนียว มด หรือราดำบนพื้นผิวใกล้เคียง'],
                'favorable_conditions_en' => ['Abundant soft new growth', 'Warm conditions and an unchecked colony', 'Crowded foliage that makes inspection difficult'],
                'favorable_conditions_th' => ['พืชมีเนื้อเยื่อและยอดอ่อนจำนวนมาก', 'อากาศอบอุ่นและไม่ได้ควบคุมกลุ่มเพลี้ยตั้งแต่เริ่มพบ', 'ทรงพุ่มแน่นจนตรวจดูใต้ใบได้ยาก'],
                'prevention_en' => ['Check new shoots and leaf undersides regularly.', 'Isolate and inspect newly introduced plants before placing them nearby.', 'Avoid unnecessary excess fertilizer that encourages very soft growth.'],
                'prevention_th' => ['ตรวจยอดใหม่และใต้ใบอย่างสม่ำเสมอ', 'แยกและตรวจพืชใหม่ก่อนนำมาวางใกล้ต้นอื่น', 'หลีกเลี่ยงการให้ปุ๋ยมากเกินจำเป็นจนเกิดยอดอ่อนจำนวนมาก'],
                'treatment_action_keys' => ['aphid-treatment'],
                'sources' => [[
                    'label_en' => 'University of Minnesota Extension — Aphids',
                    'label_th' => 'University of Minnesota Extension — เพลี้ยอ่อน',
                    'url' => 'https://extension.umn.edu/yard-and-garden-insects/aphids',
                ]],
            ],
            'snail' => [
                'family' => 'Gastropoda',
                'category_en' => 'Chewing pest',
                'category_th' => 'ศัตรูพืชกัดกินใบ',
                'summary_en' => 'Snails and slugs usually feed at night or in cool, damp conditions. They scrape tender plant tissue and can damage seedlings quickly.',
                'summary_th' => 'หอยทากและทากมักออกหากินตอนกลางคืนหรือช่วงที่เย็นและชื้น โดยจะขูดกินเนื้อเยื่ออ่อนของพืชและสร้างความเสียหายกับต้นอ่อนได้รวดเร็ว',
                'signs_en' => ['Irregular holes with smooth edges on leaves or flowers', 'Silvery slime trails on leaves, soil, or nearby surfaces', 'Young shoots or seedlings clipped close to the ground'],
                'signs_th' => ['ใบหรือดอกมีรูขอบเรียบและรูปร่างไม่สม่ำเสมอ', 'พบคราบเมือกสีเงินบนใบ ดิน หรือพื้นผิวใกล้เคียง', 'ยอดอ่อนหรือต้นกล้าถูกกัดขาดใกล้ระดับดิน'],
                'favorable_conditions_en' => ['Moist soil and surfaces that remain wet into the night', 'Dense weeds, stones, boards, or debris that provide hiding places', 'Tender seedlings and low-growing foliage'],
                'favorable_conditions_th' => ['ดินและพื้นผิวชื้นต่อเนื่องจนถึงช่วงกลางคืน', 'วัชพืช หิน แผ่นไม้ หรือเศษวัสดุที่ใช้เป็นที่หลบซ่อน', 'ต้นกล้าและใบอ่อนที่อยู่ใกล้พื้นดิน'],
                'prevention_en' => ['Water near sunrise so the surface dries before night.', 'Remove weeds, debris, boards, and other damp hiding places.', 'Inspect plants after dark or early in the morning and remove pests promptly.'],
                'prevention_th' => ['ให้น้ำช่วงเช้าเพื่อให้พื้นผิวแห้งก่อนถึงกลางคืน', 'กำจัดวัชพืช เศษวัสดุ แผ่นไม้ และบริเวณชื้นที่ใช้หลบซ่อน', 'ตรวจต้นไม้หลังมืดหรือเช้าตรู่และกำจัดทันทีเมื่อพบ'],
                'treatment_action_keys' => ['snail-treatment'],
                'sources' => [[
                    'label_en' => 'UC Statewide IPM — Snails and Slugs',
                    'label_th' => 'UC Statewide IPM — หอยทากและทาก',
                    'url' => 'https://ipm.ucanr.edu/home-and-landscape/snails-and-slugs/',
                ]],
            ],
            'fungus' => [
                'family' => 'Fungi (multiple pathogens)',
                'category_en' => 'Plant disease',
                'category_th' => 'โรคพืช',
                'summary_en' => '“Fungus” in the simulation represents a group of plant diseases. Prolonged moisture and poor airflow can allow spores to infect leaves, stems, or flowers.',
                'summary_th' => '“เชื้อรา” ในระบบจำลองหมายถึงกลุ่มโรคพืชหลายชนิด ความชื้นที่ยาวนานและการระบายอากาศไม่ดีอาจทำให้สปอร์เข้าทำลายใบ ลำต้น หรือดอก',
                'signs_en' => ['White, gray, brown, or dark spots and patches on plant tissue', 'Powdery, fuzzy, or mold-like growth', 'Soft rot, blighted tissue, yellowing, or wilting'],
                'signs_th' => ['เกิดจุดหรือปื้นสีขาว เทา น้ำตาล หรือดำบนเนื้อเยื่อพืช', 'พบผง เส้นใย หรือคราบที่มีลักษณะคล้ายรา', 'เนื้อเยื่อเน่า นิ่ม แห้งไหม้ เหลือง หรือเหี่ยว'],
                'favorable_conditions_en' => ['Leaves remain wet after overhead watering, rain, or dew', 'High humidity with dense foliage and poor air movement', 'Infected debris or tools that carry spores between plants'],
                'favorable_conditions_th' => ['ใบเปียกนานหลังรดน้ำจากด้านบน ฝน หรือน้ำค้าง', 'ความชื้นสูงร่วมกับทรงพุ่มแน่นและอากาศถ่ายเทไม่ดี', 'เศษพืชหรือเครื่องมือปนเปื้อนที่พาสปอร์ไปยังต้นอื่น'],
                'prevention_en' => ['Water at the base in the morning and keep leaves as dry as possible.', 'Space plants and prune crowded growth to improve airflow.', 'Remove infected tissue when dry and clean tools before using them again.'],
                'prevention_th' => ['ให้น้ำที่โคนในช่วงเช้าและพยายามไม่ให้ใบเปียกนาน', 'เว้นระยะและตัดแต่งทรงพุ่มเพื่อเพิ่มการถ่ายเทอากาศ', 'นำเนื้อเยื่อที่ติดโรคออกขณะแห้งและทำความสะอาดเครื่องมือก่อนใช้ซ้ำ'],
                'treatment_action_keys' => ['fungus-treatment'],
                'sources' => [
                    [
                        'label_en' => 'University of Minnesota Extension — Preventing plant diseases',
                        'label_th' => 'University of Minnesota Extension — การป้องกันโรคพืช',
                        'url' => 'https://extension.umn.edu/how/preventing-plant-diseases-garden',
                    ],
                    [
                        'label_en' => 'University of Minnesota Extension — Managing plant diseases',
                        'label_th' => 'University of Minnesota Extension — การจัดการโรคพืช',
                        'url' => 'https://extension.umn.edu/planting-and-growing-guides/managing-plant-diseases-home-garden',
                    ],
                ],
            ],
        ];
    }
}

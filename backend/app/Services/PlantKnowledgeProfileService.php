<?php

namespace App\Services;

use App\Models\Plant;
use App\Models\PlantKnowledge;
use Illuminate\Support\Str;

class PlantKnowledgeProfileService
{
    /**
     * Create the built-in guide only when an administrator has not created one.
     * Existing knowledge is intentionally never overwritten by automation.
     */
    public function syncIfMissing(Plant $plant): bool
    {
        if (PlantKnowledge::withTrashed()->where('plant_id', $plant->id)->exists()) {
            return false;
        }

        $profile = $this->profileFor($plant);
        if ($profile === null) {
            return false;
        }

        PlantKnowledge::query()->create([
            'plant_id' => $plant->id,
            ...$profile,
        ]);

        return true;
    }

    /** @return array<string, mixed>|null */
    private function profileFor(Plant $plant): ?array
    {
        $name = Str::lower(trim((string) $plant->name_en . ' ' . (string) $plant->name_th));

        if (Str::contains($name, ['tulip', 'tulipa', 'ทิวลิป'])) {
            return [
                'scientific_name' => 'Tulipa spp. / Tulipa hybrids',
                'family' => 'Liliaceae',
                'category_en' => 'Spring-flowering perennial bulb',
                'category_th' => 'ไม้หัวออกดอกในฤดูใบไม้ผลิ',
                'summary_en' => 'Tulips are cool-season bulbs valued for their cup-shaped spring flowers. This academy profile represents a general garden tulip rather than one named cultivar.',
                'summary_th' => 'ทิวลิปเป็นไม้หัวฤดูเย็นที่มีดอกรูปถ้วยในฤดูใบไม้ผลิ โปรไฟล์นี้แทนทิวลิปสวนโดยรวม ไม่ได้ระบุสายพันธุ์ปลูกเฉพาะ',
                'care_en' => [
                    'Plant the bulb with its pointed end up in rich, well-drained soil.',
                    'Provide bright light during active growth and protect emerging leaves from heat.',
                    'Water when the soil surface begins to dry, but never leave the bulb sitting in water.',
                    'Tulip bulbs need a cool period before active shoot and flower development.',
                ],
                'care_th' => [
                    'วางหัวโดยให้ปลายแหลมชี้ขึ้นในดินที่อุดมสมบูรณ์และระบายน้ำดี',
                    'ให้แสงสว่างเพียงพอระหว่างเติบโต และป้องกันใบอ่อนจากความร้อนจัด',
                    'รดน้ำเมื่อผิวดินเริ่มแห้ง แต่ไม่ปล่อยให้หัวแช่น้ำ',
                    'หัวทิวลิปต้องผ่านช่วงอากาศเย็นก่อนสร้างยอดและดอก',
                ],
                'caution_en' => 'Allow healthy foliage to yellow after flowering so the bulb can rebuild its stored energy.',
                'caution_th' => 'หลังดอกโรยควรรอให้ใบที่ยังเขียวค่อย ๆ เหลือง เพื่อให้หัวสะสมพลังงานกลับคืน',
                'sources' => [
                    ['label_en' => 'University of Minnesota Extension — growing bulbs indoors', 'label_th' => 'University of Minnesota Extension — การปลูกไม้หัวในอาคาร', 'url' => 'https://extension.umn.edu/gardening-minnesota/growing-bulbs-indoors'],
                    ['label_en' => 'Missouri Botanical Garden — Tulipa cultivation', 'label_th' => 'Missouri Botanical Garden — การปลูกทิวลิป', 'url' => 'https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=c252'],
                ],
            ];
        }

        if (Str::contains($name, ['sunflower', 'helianthus', 'ทานตะวัน'])) {
            return [
                'scientific_name' => 'Helianthus annuus L.',
                'family' => 'Asteraceae',
                'category_en' => 'Annual flowering plant',
                'category_th' => 'ไม้ดอกล้มลุกอายุปีเดียว',
                'summary_en' => 'Sunflower is a fast-growing annual that develops a strong stem and flower head in full light. Cultivars vary, so the simulation uses a general garden sunflower profile.',
                'summary_th' => 'ทานตะวันเป็นไม้ดอกล้มลุกที่โตเร็ว ต้องการแสงมากเพื่อสร้างลำต้นแข็งแรงและช่อดอก โดยสายพันธุ์อาจมีระยะเติบโตต่างกัน ระบบใช้โปรไฟล์ทานตะวันสวนโดยรวม',
                'care_en' => [
                    'Give the plant a bright position with several hours of direct sunlight.',
                    'Keep soil evenly moist while seedlings establish, then water deeply when the surface begins to dry.',
                    'Use a balanced feed lightly; excessive nitrogen can produce leaves at the expense of flowers.',
                    'Provide a sturdy, well-drained root zone because mature stems can become top-heavy.',
                ],
                'care_th' => [
                    'วางต้นในจุดที่ได้รับแสงแดดโดยตรงหลายชั่วโมงต่อวัน',
                    'รักษาความชื้นให้สม่ำเสมอในช่วงต้นกล้า แล้วรดน้ำให้ลึกเมื่อผิวดินเริ่มแห้ง',
                    'ใช้ปุ๋ยสมดุลในปริมาณพอเหมาะ เพราะไนโตรเจนมากเกินไปทำให้ใบมากแต่ดอกน้อย',
                    'ดูแลให้ดินระบายน้ำดีและลำต้นมีความมั่นคง เพราะต้นโตอาจมีน้ำหนักด้านบนมาก',
                ],
                'caution_en' => 'Do not keep the root zone waterlogged. Support tall cultivars when the stem becomes heavy with the flower head.',
                'caution_th' => 'อย่าปล่อยให้บริเวณรากมีน้ำขัง และควรค้ำต้นพันธุ์สูงเมื่อช่อดอกเริ่มมีน้ำหนักมาก',
                'sources' => [
                    ['label_en' => 'Iowa State University Extension — growing sunflowers and varieties', 'label_th' => 'Iowa State University Extension — การปลูกทานตะวันและสายพันธุ์', 'url' => 'https://yardandgarden.extension.iastate.edu/how-to/growing-sunflowers-and-their-varieties'],
                    ['label_en' => 'Royal Horticultural Society — sunflowers', 'label_th' => 'Royal Horticultural Society — ทานตะวัน', 'url' => 'https://www.rhs.org.uk/plants/sunflowers/growing-guide'],
                ],
            ];
        }

        if (Str::contains($name, ['elephant ear', 'xanthosoma', 'บอนกระดาด', 'หูช้าง'])) {
            return [
                'scientific_name' => 'Xanthosoma sagittifolium (L.) Schott',
                'family' => 'Araceae',
                'category_en' => 'Tropical herbaceous perennial',
                'category_th' => 'ไม้ล้มลุกเขตร้อนอายุหลายปี',
                'summary_en' => 'A warm-climate aroid grown from an underground corm, known for large arrow-shaped leaves on long stalks.',
                'summary_th' => 'พืชวงศ์บอนจากเขตร้อน เติบโตจากหัวใต้ดิน มีใบขนาดใหญ่รูปหัวลูกศรบนก้านยาว',
                'care_en' => [
                    'Use rich, moist but freely draining soil.',
                    'Part shade is safest; strong direct sun can bleach or scorch broad leaves.',
                    'Warm, humid conditions support active foliage growth.',
                ],
                'care_th' => [
                    'ใช้ดินร่วนที่อุดมสมบูรณ์ ชื้นสม่ำเสมอแต่ระบายน้ำได้ดี',
                    'เหมาะกับร่มรำไรถึงร่ม แสงแดดจัดอาจทำให้ใบซีดหรือไหม้',
                    'อากาศอุ่นและมีความชื้นช่วยให้สร้างใบได้ดี',
                ],
                'caution_en' => 'Plant tissues contain calcium oxalate and may irritate skin or the mouth.',
                'caution_th' => 'เนื้อเยื่อมีแคลเซียมออกซาเลตซึ่งอาจระคายเคืองผิวหนังและช่องปาก',
                'sources' => [
                    ['label_en' => 'University of Florida IFAS — species profile', 'label_th' => 'University of Florida IFAS — ข้อมูลชนิดพืช', 'url' => 'https://plant-directory.ifas.ufl.edu/plant-directory/xanthosoma-sagittifolium/'],
                    ['label_en' => 'Kew Science — accepted taxonomy', 'label_th' => 'Kew Science — อนุกรมวิธานที่ยอมรับ', 'url' => 'https://powo.science.kew.org/taxon/89373-1'],
                ],
            ];
        }

        return null;
    }
}

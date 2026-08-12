<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('event_definitions')) {
            return;
        }

        $guidance = [
            'lamp-flicker' => [
                'Light output may fall temporarily. Review the Light control before the event becomes active.',
                'กำลังแสงอาจลดลงชั่วคราว ควรตรวจและปรับค่าแสงก่อนเหตุการณ์เริ่มทำงาน',
            ],
            'gentle-cycle' => [
                'Conditions are temporarily favorable. Observe the response and avoid unnecessary adjustments.',
                'สภาพแวดล้อมเหมาะสมชั่วคราว ควรสังเกตการตอบสนองและหลีกเลี่ยงการปรับค่าที่ไม่จำเป็น',
            ],
            'light-rain' => [
                'Light rain adds water naturally. Monitor soil moisture and prepare Drainage Mix if it rises too far.',
                'ฝนเบาช่วยเพิ่มน้ำตามธรรมชาติ ควรติดตามความชื้นดินและเตรียมวัสดุช่วยระบายน้ำหากค่าสูงเกินไป',
            ],
            'heavy-rain' => [
                'Heavy rain can waterlog the root zone. Use Drainage Mix before the next update if moisture becomes excessive.',
                'ฝนหนักอาจทำให้บริเวณรากมีน้ำขัง ใช้วัสดุช่วยระบายน้ำก่อนรอบถัดไปหากความชื้นสูงเกินไป',
            ],
            'heat-wave' => [
                'Air and soil temperature will rise while water falls. Prepare Shade Cloth and a Watering Dose.',
                'อุณหภูมิอากาศและดินจะสูงขึ้นพร้อมกับน้ำที่ลดลง ควรเตรียมผ้าบังแดดและน้ำสำหรับรดพืช',
            ],
            'strong-wind' => [
                'Strong wind can dry and stress the plant. Deploy a Windbreak before the event peaks.',
                'ลมแรงอาจทำให้พืชสูญเสียน้ำและเกิดความเครียด ควรวางแนวกันลมก่อนเหตุการณ์รุนแรงขึ้น',
            ],
            'cold-snap' => [
                'Air and soil temperature will drop. Use Frost Cover before the event becomes active.',
                'อุณหภูมิอากาศและดินจะลดลง ควรใช้วัสดุป้องกันอากาศเย็นก่อนเหตุการณ์เริ่มทำงาน',
            ],
        ];

        foreach ($guidance as $eventKey => [$english, $thai]) {
            DB::table('event_definitions')->where('event_key', $eventKey)->update([
                'description_en' => $english,
                'description_th' => $thai,
                'updated_at' => now(),
            ]);
        }

        $now = now();
        $this->upsertEvent([
            'event_key' => 'airflow-shift',
            'name_en' => 'Airflow shift',
            'name_th' => 'การไหลเวียนอากาศเปลี่ยนแปลง',
            'description_en' => 'Humidity may fall as airflow changes. Review the Air control before the next update.',
            'description_th' => 'ความชื้นอาจลดลงเมื่อการไหลเวียนอากาศเปลี่ยน ควรตรวจค่าอากาศก่อนรอบอัปเดตถัดไป',
            'mode_scope' => 'greenhouse',
            'severity' => 'low',
            'weight' => 16,
            'trigger_chance' => 14,
            'warning_ticks' => 0,
            'duration_ticks' => 2,
            'cooldown_ticks' => 3,
            'conditions' => [],
            'effects' => ['factor_delta' => ['air_humidity' => -8]],
            'response_action_keys' => ['air'],
            'is_harmful' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->upsertEvent([
            'event_key' => 'irrigation-delay',
            'name_en' => 'Irrigation delay',
            'name_th' => 'การให้น้ำติดขัด',
            'description_en' => 'The water level may fall. Apply a Watering Dose or adjust Water before the next update.',
            'description_th' => 'ระดับน้ำอาจลดลง ควรใช้น้ำสำหรับรดพืชหรือปรับค่าน้ำก่อนรอบอัปเดตถัดไป',
            'mode_scope' => 'greenhouse',
            'severity' => 'medium',
            'weight' => 10,
            'trigger_chance' => 12,
            'warning_ticks' => 1,
            'duration_ticks' => 2,
            'cooldown_ticks' => 3,
            'conditions' => ['water' => ['max' => 80]],
            'effects' => ['factor_delta' => ['water' => -12]],
            'response_action_keys' => ['water'],
            'is_harmful' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function upsertEvent(array $event): void
    {
        foreach (['conditions', 'effects', 'response_action_keys'] as $jsonField) {
            $event[$jsonField] = json_encode($event[$jsonField], JSON_THROW_ON_ERROR);
        }

        DB::table('event_definitions')->updateOrInsert(
            ['event_key' => $event['event_key']],
            $event,
        );
    }

    public function down(): void
    {
        if (Schema::hasTable('event_definitions')) {
            DB::table('event_definitions')->whereIn('event_key', ['airflow-shift', 'irrigation-delay'])->delete();
        }
    }
};

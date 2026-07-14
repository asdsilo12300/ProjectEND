<?php

namespace Database\Seeders;

use App\Models\Content;
use Illuminate\Database\Seeder;

class LearningContentSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->articles() as $article) {
            Content::query()->updateOrCreate(['slug' => $article['slug']], $article);
        }
    }

    private function articles(): array
    {
        return [
            [
                'slug' => 'understanding-plants',
                'category' => 'plant-basics',
                'icon' => 'plant',
                'eyebrow' => 'Plant foundations',
                'eyebrow_th' => 'พื้นฐานเรื่องพืช',
                'title' => 'Understanding plants: structure, transport, and growth',
                'title_th' => 'ทำความเข้าใจพืช: โครงสร้าง การลำเลียง และการเติบโต',
                'summary' => 'Meet the roots, stems, leaves, and transport tissues that work together to keep a plant alive and growing.',
                'summary_th' => 'รู้จักราก ลำต้น ใบ และเนื้อเยื่อลำเลียงที่ทำงานร่วมกันเพื่อให้พืชมีชีวิตและเติบโต',
                'body_html' => <<<'HTML'
<p class="article-intro">A plant may look still, but it is a highly coordinated living system. Its organs collect resources, move water and sugars, protect delicate tissues, and continuously build new cells.</p>
<h2>A plant has two connected organ systems</h2>
<p>The <strong>root system</strong> is usually below ground. It anchors the plant, absorbs water and dissolved minerals, and can store energy. The <strong>shoot system</strong> includes stems, leaves, flowers, and fruits. It positions leaves for light, supports reproduction, and connects every part of the plant.</p>
<div class="article-callout"><strong>Think of the plant as a supply network:</strong> roots collect, stems connect, leaves manufacture sugars, and flowers or fruits support reproduction.</div>
<h2>Roots: absorption and support</h2>
<p>Young roots grow from their tips. Root hairs greatly increase the surface area that touches moist soil, helping water and mineral ions enter. A root cap protects the growing tip as it pushes through soil.</p>
<h2>Stems: support and transport</h2>
<p>Stems hold leaves where they can receive light. Inside the stem, two vascular tissues move materials:</p>
<ul>
  <li><strong>Xylem</strong> carries water and minerals mainly upward from the roots.</li>
  <li><strong>Phloem</strong> distributes sugars from productive leaves to growing or storage tissues.</li>
</ul>
<h2>Leaves: efficient solar collectors</h2>
<p>The broad leaf blade captures light. Tiny pores called <strong>stomata</strong> regulate the exchange of carbon dioxide, oxygen, and water vapor. Inside the leaf, chloroplast-rich cells perform most photosynthesis.</p>
<h2>How plants become larger</h2>
<p>Growth is concentrated in regions called <strong>meristems</strong>. Apical meristems lengthen roots and shoots; lateral meristems increase the thickness of many stems and roots. New cells divide, enlarge, and then specialize for protection, transport, storage, or photosynthesis.</p>
<h2>Use this knowledge in the simulation</h2>
<p>When a plant wilts, grows slowly, or changes leaf color, look beyond one symptom. Ask whether roots can absorb water, whether the stem can transport resources, and whether the leaves have enough light and healthy gas exchange.</p>
<h3>Key ideas</h3>
<ul>
  <li>Plant organs are specialized, but none works alone.</li>
  <li>Water and minerals move through xylem; sugars move through phloem.</li>
  <li>Most new growth begins in meristems.</li>
</ul>
HTML,
                'body_html_th' => <<<'HTML'
<p class="article-intro">แม้พืชจะดูนิ่ง แต่ภายในเป็นระบบมีชีวิตที่ประสานงานกันตลอดเวลา อวัยวะแต่ละส่วนทำหน้าที่รับทรัพยากร ลำเลียงน้ำและน้ำตาล ปกป้องเนื้อเยื่อ และสร้างเซลล์ใหม่อย่างต่อเนื่อง</p>
<h2>พืชมีระบบอวัยวะ 2 ส่วนที่เชื่อมถึงกัน</h2>
<p><strong>ระบบราก</strong> มักอยู่ใต้ดิน ทำหน้าที่ยึดพืช ดูดน้ำและแร่ธาตุที่ละลายในดิน รวมถึงเก็บสะสมพลังงาน ส่วน <strong>ระบบยอด</strong> ประกอบด้วยลำต้น ใบ ดอก และผล ทำหน้าที่จัดตำแหน่งใบให้รับแสง รองรับการสืบพันธุ์ และเชื่อมทุกส่วนเข้าด้วยกัน</p>
<div class="article-callout"><strong>ลองมองพืชเป็นเครือข่ายจัดส่ง:</strong> รากรับทรัพยากร ลำต้นเชื่อมต่อ ใบผลิตน้ำตาล และดอกหรือผลช่วยในการสืบพันธุ์</div>
<h2>ราก: การดูดซึมและการยึดเกาะ</h2>
<p>รากอ่อนเติบโตจากบริเวณปลายราก ขนรากช่วยเพิ่มพื้นที่ผิวที่สัมผัสดินชื้น ทำให้น้ำและไอออนแร่ธาตุเข้าสู่พืชได้ดีขึ้น หมวกรากช่วยปกป้องเนื้อเยื่อที่กำลังแบ่งตัวขณะรากดันผ่านดิน</p>
<h2>ลำต้น: การพยุงและลำเลียง</h2>
<p>ลำต้นช่วยจัดใบให้รับแสง ภายในมีเนื้อเยื่อลำเลียงสำคัญ 2 ชนิด:</p>
<ul>
  <li><strong>ไซเล็ม (xylem)</strong> ลำเลียงน้ำและแร่ธาตุจากรากขึ้นไปยังส่วนต่าง ๆ</li>
  <li><strong>โฟลเอ็ม (phloem)</strong> กระจายน้ำตาลจากใบไปยังส่วนที่กำลังเติบโตหรือสะสมอาหาร</li>
</ul>
<h2>ใบ: แผงรับพลังงานที่มีประสิทธิภาพ</h2>
<p>แผ่นใบที่กว้างช่วยรับแสง รูเล็ก ๆ ที่เรียกว่า <strong>ปากใบ</strong> ควบคุมการแลกเปลี่ยนคาร์บอนไดออกไซด์ ออกซิเจน และไอน้ำ ภายในใบมีเซลล์ที่อุดมด้วยคลอโรพลาสต์ซึ่งเป็นบริเวณหลักของการสังเคราะห์ด้วยแสง</p>
<h2>พืชโตขึ้นได้อย่างไร</h2>
<p>การเติบโตเกิดมากในบริเวณที่เรียกว่า <strong>เนื้อเยื่อเจริญ</strong> เนื้อเยื่อเจริญส่วนปลายทำให้รากและยอดยาวขึ้น ส่วนเนื้อเยื่อเจริญด้านข้างช่วยเพิ่มความหนาของลำต้นและราก เซลล์ใหม่จะแบ่งตัว ขยายขนาด และเปลี่ยนไปทำหน้าที่เฉพาะ</p>
<h2>นำไปใช้ในระบบจำลอง</h2>
<p>เมื่อพืชเหี่ยว โตช้า หรือใบเปลี่ยนสี อย่าดูเพียงอาการเดียว ลองตรวจว่ารากรับน้ำได้หรือไม่ ลำต้นลำเลียงทรัพยากรได้ดีหรือไม่ และใบได้รับแสงพร้อมแลกเปลี่ยนก๊าซอย่างเหมาะสมหรือไม่</p>
<h3>แนวคิดสำคัญ</h3>
<ul>
  <li>อวัยวะของพืชมีหน้าที่เฉพาะ แต่ทุกส่วนต้องทำงานร่วมกัน</li>
  <li>น้ำและแร่ธาตุเคลื่อนผ่านไซเล็ม ส่วนน้ำตาลเคลื่อนผ่านโฟลเอ็ม</li>
  <li>การเติบโตใหม่ส่วนใหญ่เริ่มจากเนื้อเยื่อเจริญ</li>
</ul>
HTML,
                'cover_image_url' => 'https://openstax.org/apps/image-cdn/v1/f%3Dwebp/apps/archive/20260604.144757/resources/45a27c0f0e841e70203290ee8ead4ed1eeeaec3d',
                'cover_image_alt' => 'Diagram of a flowering plant showing its shoot and root systems',
                'cover_image_alt_th' => 'แผนภาพพืชดอกที่แสดงระบบยอดและระบบราก',
                'image_credit' => 'OpenStax, Biology 2e, Figure 30.2 (CC BY-NC-SA 4.0)',
                'image_credit_url' => 'https://openstax.org/books/biology-2e/pages/30-1-the-plant-body',
                'references' => [
                    ['title' => '30.1 The Plant Body', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/30-1-the-plant-body'],
                    ['title' => '30.3 Roots', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/30-3-roots'],
                    ['title' => '30.4 Leaves', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/30-4-leaves'],
                ],
                'reading_minutes' => 6,
                'sort_order' => 1,
                'version' => 1,
                'source_code' => 'curated-open-education',
                'status' => 'published',
                'published_at' => '2026-07-14 00:00:00',
            ],
            [
                'slug' => 'environmental-factors-for-plant-growth',
                'category' => 'environment',
                'icon' => 'air',
                'eyebrow' => 'Growing conditions',
                'eyebrow_th' => 'สภาพแวดล้อมในการปลูก',
                'title' => 'Environmental factors that shape plant growth',
                'title_th' => 'ปัจจัยสิ่งแวดล้อมที่กำหนดการเติบโตของพืช',
                'summary' => 'Understand how light, temperature, water, humidity, air, soil, and nutrients interact—and how to diagnose imbalance.',
                'summary_th' => 'เข้าใจการทำงานร่วมกันของแสง อุณหภูมิ น้ำ ความชื้น อากาศ ดิน และธาตุอาหาร พร้อมวิธีสังเกตความไม่สมดุล',
                'body_html' => <<<'HTML'
<p class="article-intro">A plant grows best when several environmental requirements are balanced. If one essential factor is too low or too high, it can become the limiting factor that slows the whole system.</p>
<h2>1. Light: quantity, quality, and duration</h2>
<p>Light intensity affects how much energy is available for photosynthesis. Light quality means wavelength or color; red and blue wavelengths are especially useful to plants. Duration, or photoperiod, can influence flowering and seasonal responses.</p>
<h2>2. Temperature: the pace of plant processes</h2>
<p>Temperature changes the speed of photosynthesis, respiration, transpiration, germination, and flowering. Each species has a useful range. Outside it, enzymes work poorly, water loss may rise, and growth can slow or stop.</p>
<h2>3. Water and humidity: movement and cooling</h2>
<p>Water is a reactant in photosynthesis, a solvent for transported minerals, and the source of turgor pressure that keeps tissues firm. As water evaporates through stomata, it cools leaves. Low humidity, heat, and wind can accelerate water loss.</p>
<h2>4. Air and carbon dioxide</h2>
<p>Leaves need access to carbon dioxide for photosynthesis and oxygen for cellular respiration. Waterlogged or compacted soil can also deprive roots of the oxygen needed to release usable energy.</p>
<h2>5. Soil and nutrients</h2>
<p>Roots need a moist but aerated growing medium. Soil pH influences which nutrients remain available. Plants require macronutrients such as nitrogen, phosphorus, potassium, calcium, magnesium, and sulfur, plus smaller amounts of micronutrients.</p>
<div class="article-callout"><strong>Fertilizer is not plant food.</strong> Plants manufacture sugars using light, water, and carbon dioxide. Mineral nutrients help them build proteins, enzymes, chlorophyll, cell walls, and other structures.</div>
<h2>Diagnose the system, not only the symptom</h2>
<table>
  <thead><tr><th>Observation</th><th>Factors to check first</th></tr></thead>
  <tbody>
    <tr><td>Wilting</td><td>Water supply, root health, heat, humidity, wind</td></tr>
    <tr><td>Pale or yellow leaves</td><td>Light, nitrogen, root oxygen, soil pH</td></tr>
    <tr><td>Slow growth</td><td>Temperature, light, water, nutrients, root space</td></tr>
    <tr><td>Leaf edge burn</td><td>Salt buildup, potassium balance, heat, dry air</td></tr>
  </tbody>
</table>
<h2>Run a fair experiment</h2>
<p>Change one factor at a time, allow enough time for a response, and compare with the previous condition. In the simulation, use the history view to separate a real pattern from a short-term fluctuation.</p>
HTML,
                'body_html_th' => <<<'HTML'
<p class="article-intro">พืชเติบโตได้ดีที่สุดเมื่อความต้องการด้านสิ่งแวดล้อมหลายอย่างอยู่ในสมดุล หากปัจจัยจำเป็นอย่างใดอย่างหนึ่งต่ำหรือสูงเกินไป ปัจจัยนั้นอาจกลายเป็นตัวจำกัดที่ทำให้ทั้งระบบช้าลง</p>
<h2>1. แสง: ปริมาณ คุณภาพ และระยะเวลา</h2>
<p>ความเข้มแสงมีผลต่อพลังงานที่ใช้ในการสังเคราะห์ด้วยแสง คุณภาพแสงหมายถึงความยาวคลื่นหรือสี โดยช่วงแสงสีแดงและน้ำเงินมีความสำคัญต่อพืช ส่วนระยะเวลารับแสงหรือช่วงแสงมีผลต่อการออกดอกและการตอบสนองตามฤดูกาล</p>
<h2>2. อุณหภูมิ: ตัวกำหนดความเร็วของกระบวนการ</h2>
<p>อุณหภูมิเปลี่ยนความเร็วของการสังเคราะห์ด้วยแสง การหายใจ การคายน้ำ การงอก และการออกดอก พืชแต่ละชนิดมีช่วงที่เหมาะสม หากออกนอกช่วง เอนไซม์อาจทำงานไม่ดี การสูญเสียน้ำเพิ่มขึ้น และการเติบโตอาจช้าหรือหยุด</p>
<h2>3. น้ำและความชื้น: การลำเลียงและการระบายความร้อน</h2>
<p>น้ำเป็นสารตั้งต้นของการสังเคราะห์ด้วยแสง เป็นตัวทำละลายแร่ธาตุ และสร้างแรงดันเต่งที่ช่วยให้เนื้อเยื่อคงรูป การระเหยน้ำผ่านปากใบช่วยลดอุณหภูมิของใบ แต่ความชื้นต่ำ อากาศร้อน และลมแรงจะเร่งการสูญเสียน้ำ</p>
<h2>4. อากาศและคาร์บอนไดออกไซด์</h2>
<p>ใบต้องได้รับคาร์บอนไดออกไซด์เพื่อสังเคราะห์ด้วยแสงและใช้ออกซิเจนในการหายใจระดับเซลล์ ดินที่มีน้ำขังหรือแน่นเกินไปอาจทำให้รากขาดออกซิเจนและสร้างพลังงานที่ใช้งานได้ไม่เพียงพอ</p>
<h2>5. ดินและธาตุอาหาร</h2>
<p>รากต้องการวัสดุปลูกที่ชื้นแต่มีอากาศแทรก ค่า pH ของดินมีผลต่อความพร้อมใช้ของธาตุอาหาร พืชต้องการธาตุหลัก เช่น ไนโตรเจน ฟอสฟอรัส โพแทสเซียม แคลเซียม แมกนีเซียม และกำมะถัน รวมถึงธาตุอาหารรองในปริมาณน้อย</p>
<div class="article-callout"><strong>ปุ๋ยไม่ใช่อาหารของพืช</strong> พืชสร้างน้ำตาลจากแสง น้ำ และคาร์บอนไดออกไซด์ ส่วนแร่ธาตุช่วยสร้างโปรตีน เอนไซม์ คลอโรฟิลล์ ผนังเซลล์ และโครงสร้างอื่น ๆ</div>
<h2>วิเคราะห์ทั้งระบบ ไม่ใช่เพียงอาการ</h2>
<table>
  <thead><tr><th>สิ่งที่สังเกต</th><th>ปัจจัยที่ควรตรวจเป็นอันดับแรก</th></tr></thead>
  <tbody>
    <tr><td>เหี่ยว</td><td>น้ำ สุขภาพราก ความร้อน ความชื้น และลม</td></tr>
    <tr><td>ใบซีดหรือเหลือง</td><td>แสง ไนโตรเจน ออกซิเจนที่ราก และ pH ของดิน</td></tr>
    <tr><td>โตช้า</td><td>อุณหภูมิ แสง น้ำ ธาตุอาหาร และพื้นที่ราก</td></tr>
    <tr><td>ขอบใบไหม้</td><td>การสะสมเกลือ สมดุลโพแทสเซียม ความร้อน และอากาศแห้ง</td></tr>
  </tbody>
</table>
<h2>ทดลองอย่างยุติธรรม</h2>
<p>เปลี่ยนทีละหนึ่งปัจจัย รอเวลาให้พืชตอบสนอง และเปรียบเทียบกับสภาพก่อนหน้า ในระบบจำลองควรใช้หน้าประวัติเพื่อแยกรูปแบบที่เกิดจริงออกจากความผันผวนระยะสั้น</p>
HTML,
                'cover_image_url' => 'https://extension.oregonstate.edu/sites/extd8/files/styles/full/public/images/2024-08/photoperiodism-1.png?itok=X1mejh_e',
                'cover_image_alt' => 'Diagram comparing short-day and long-day plant flowering responses',
                'cover_image_alt_th' => 'แผนภาพเปรียบเทียบการออกดอกของพืชวันสั้นและพืชวันยาว',
                'image_credit' => 'Holly Thompson / Oregon State University Extension Service',
                'image_credit_url' => 'https://extension.oregonstate.edu/gardening/techniques/environmental-factors-affecting-plant-growth',
                'references' => [
                    ['title' => 'Environmental factors affecting plant growth', 'organization' => 'Oregon State University Extension Service', 'url' => 'https://extension.oregonstate.edu/gardening/techniques/environmental-factors-affecting-plant-growth'],
                    ['title' => '30.5 Transport of Water and Solutes in Plants', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/30-5-transport-of-water-and-solutes-in-plants'],
                    ['title' => 'Water and Nutrient Cycling', 'organization' => 'USDA Agricultural Research Service', 'url' => 'https://www.ars.usda.gov/ARSUserFiles/20540000/k12/water.htm'],
                ],
                'reading_minutes' => 8,
                'sort_order' => 2,
                'version' => 1,
                'source_code' => 'curated-extension-education',
                'status' => 'published',
                'published_at' => '2026-07-14 00:00:00',
            ],
            [
                'slug' => 'photosynthesis-explained',
                'category' => 'photosynthesis',
                'icon' => 'bolt',
                'eyebrow' => 'Energy for life',
                'eyebrow_th' => 'พลังงานสำหรับชีวิต',
                'title' => 'Photosynthesis: how plants turn light into stored energy',
                'title_th' => 'การสังเคราะห์ด้วยแสง: พืชเปลี่ยนแสงเป็นพลังงานสะสมได้อย่างไร',
                'summary' => 'Follow light, water, and carbon dioxide through the leaf to understand where sugars and oxygen come from.',
                'summary_th' => 'ติดตามเส้นทางของแสง น้ำ และคาร์บอนไดออกไซด์ภายในใบ เพื่อเข้าใจที่มาของน้ำตาลและออกซิเจน',
                'body_html' => <<<'HTML'
<p class="article-intro">Photosynthesis is the process that converts light energy into chemical energy stored in organic molecules. It supplies plants with carbon-rich material for growth and supports most food webs on Earth.</p>
<h2>The inputs and outputs</h2>
<div class="article-equation">6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂</div>
<p>This equation is a useful summary, not a single reaction. Plants use carbon dioxide and water through many enzyme-controlled steps. The products include carbohydrate building blocks and oxygen.</p>
<h2>Where it happens</h2>
<p>Most photosynthesis occurs in leaves. Carbon dioxide enters through stomata, water arrives through xylem, and light is absorbed by pigments. Inside mesophyll cells, <strong>chloroplasts</strong> contain the membranes and enzymes required for the process.</p>
<h2>Stage 1: light-dependent reactions</h2>
<p>Chlorophyll and associated pigments absorb light in the thylakoid membranes. This energy drives electron movement, splits water, releases oxygen, and produces short-term energy carriers called ATP and NADPH.</p>
<h2>Stage 2: the Calvin cycle</h2>
<p>In the chloroplast stroma, enzymes use ATP and NADPH to incorporate carbon dioxide into three-carbon molecules. These can later be assembled into glucose, sucrose, starch, cellulose, and many other compounds.</p>
<div class="article-callout"><strong>Where does plant mass come from?</strong> Much of the dry mass added during growth comes from carbon dioxide in the air, not directly from soil. Minerals are essential, but carbon forms the backbone of sugars and many plant structures.</div>
<h2>What changes the rate?</h2>
<ul>
  <li><strong>Light:</strong> more usable light can increase the rate until another factor becomes limiting.</li>
  <li><strong>Carbon dioxide:</strong> insufficient CO₂ can restrict carbon fixation.</li>
  <li><strong>Water:</strong> drought may close stomata, reducing CO₂ entry.</li>
  <li><strong>Temperature:</strong> photosynthetic enzymes work best within a species-specific range.</li>
  <li><strong>Leaf health:</strong> chlorophyll, nutrients, and intact tissue are required.</li>
</ul>
<h2>Why photosynthesis matters beyond one plant</h2>
<p>The stored chemical energy moves through food chains when organisms eat plants or eat organisms that consumed plants. Photosynthesis also releases oxygen and removes carbon dioxide from the atmosphere, linking plant growth to global carbon and oxygen cycles.</p>
<h2>Try it in the plant lab</h2>
<p>Increase light while holding water, temperature, and nutrients steady. Watch whether growth continues to improve or levels off. A plateau suggests that another factor has become limiting.</p>
HTML,
                'body_html_th' => <<<'HTML'
<p class="article-intro">การสังเคราะห์ด้วยแสงคือกระบวนการเปลี่ยนพลังงานแสงให้เป็นพลังงานเคมีที่เก็บอยู่ในโมเลกุลอินทรีย์ กระบวนการนี้ให้วัตถุดิบที่มีคาร์บอนสำหรับการเติบโตของพืช และเป็นฐานพลังงานของสายใยอาหารส่วนใหญ่บนโลก</p>
<h2>สารตั้งต้นและผลผลิต</h2>
<div class="article-equation">6CO₂ + 6H₂O + พลังงานแสง → C₆H₁₂O₆ + 6O₂</div>
<p>สมการนี้เป็นภาพรวม ไม่ใช่ปฏิกิริยาเพียงขั้นเดียว พืชใช้คาร์บอนไดออกไซด์และน้ำผ่านหลายขั้นตอนที่ควบคุมด้วยเอนไซม์ ผลลัพธ์คือสารตั้งต้นของคาร์โบไฮเดรตและออกซิเจน</p>
<h2>เกิดขึ้นที่ไหน</h2>
<p>การสังเคราะห์ด้วยแสงส่วนใหญ่เกิดในใบ คาร์บอนไดออกไซด์เข้าสู่ใบผ่านปากใบ น้ำถูกลำเลียงมาทางไซเล็ม และรงควัตถุดูดกลืนแสง ภายในเซลล์มีโซฟิลล์มี <strong>คลอโรพลาสต์</strong> ซึ่งประกอบด้วยเยื่อและเอนไซม์ที่จำเป็น</p>
<h2>ขั้นที่ 1: ปฏิกิริยาที่ต้องใช้แสง</h2>
<p>คลอโรฟิลล์และรงควัตถุอื่นดูดกลืนแสงบริเวณเยื่อไทลาคอยด์ พลังงานนี้ขับเคลื่อนการส่งผ่านอิเล็กตรอน แยกโมเลกุลน้ำ ปล่อยออกซิเจน และสร้างตัวพาพลังงานระยะสั้นที่เรียกว่า ATP และ NADPH</p>
<h2>ขั้นที่ 2: วัฏจักรคาลวิน</h2>
<p>ในสโตรมาของคลอโรพลาสต์ เอนไซม์ใช้ ATP และ NADPH เพื่อนำคาร์บอนไดออกไซด์เข้าไปสร้างโมเลกุลคาร์บอนสามอะตอม ซึ่งต่อมานำไปสร้างกลูโคส ซูโครส แป้ง เซลลูโลส และสารอื่นอีกมาก</p>
<div class="article-callout"><strong>มวลของพืชมาจากไหน?</strong> มวลแห้งส่วนใหญ่ที่เพิ่มขึ้นระหว่างการเติบโตมาจากคาร์บอนไดออกไซด์ในอากาศ ไม่ได้มาจากดินโดยตรง แร่ธาตุยังจำเป็น แต่คาร์บอนเป็นโครงหลักของน้ำตาลและโครงสร้างจำนวนมาก</div>
<h2>อะไรเปลี่ยนอัตราการสังเคราะห์ด้วยแสง</h2>
<ul>
  <li><strong>แสง:</strong> แสงที่พืชใช้ได้มากขึ้นช่วยเพิ่มอัตราจนกว่าปัจจัยอื่นจะกลายเป็นตัวจำกัด</li>
  <li><strong>คาร์บอนไดออกไซด์:</strong> CO₂ ที่ไม่เพียงพอจำกัดการตรึงคาร์บอน</li>
  <li><strong>น้ำ:</strong> ภาวะแห้งอาจทำให้ปากใบปิดและ CO₂ เข้าสู่ใบน้อยลง</li>
  <li><strong>อุณหภูมิ:</strong> เอนไซม์สังเคราะห์ด้วยแสงทำงานดีที่สุดในช่วงที่เหมาะกับพืชแต่ละชนิด</li>
  <li><strong>สุขภาพใบ:</strong> ต้องมีคลอโรฟิลล์ ธาตุอาหาร และเนื้อเยื่อที่สมบูรณ์</li>
</ul>
<h2>ทำไมกระบวนการนี้สำคัญมากกว่าพืชหนึ่งต้น</h2>
<p>พลังงานเคมีที่สะสมจะเคลื่อนผ่านสายใยอาหารเมื่อสิ่งมีชีวิตกินพืชหรือกินสิ่งมีชีวิตที่เคยกินพืช นอกจากนี้การสังเคราะห์ด้วยแสงยังปล่อยออกซิเจนและนำคาร์บอนไดออกไซด์ออกจากบรรยากาศ จึงเชื่อมการเติบโตของพืชกับวัฏจักรคาร์บอนและออกซิเจนของโลก</p>
<h2>ลองทดลองในห้องปฏิบัติการพืช</h2>
<p>เพิ่มแสงโดยคงน้ำ อุณหภูมิ และธาตุอาหารไว้เท่าเดิม จากนั้นสังเกตว่าการเติบโตเพิ่มต่อหรือเริ่มคงที่ หากกราฟเริ่มราบ แสดงว่ามีปัจจัยอื่นกลายเป็นตัวจำกัด</p>
HTML,
                'cover_image_url' => 'https://openstax.org/apps/image-cdn/v1/f%3Dwebp/apps/archive/20260604.144757/resources/5dca808faf19e8a904fe50a2b103a2c9fbc5d3df',
                'cover_image_alt' => 'Diagram showing sunlight, carbon dioxide, and water entering a plant and oxygen and sugars being produced',
                'cover_image_alt_th' => 'แผนภาพแสดงแสง คาร์บอนไดออกไซด์ และน้ำเข้าสู่พืช พร้อมการสร้างออกซิเจนและน้ำตาล',
                'image_credit' => 'OpenStax, Biology 2e, Figure 8.4 (CC BY-NC-SA 4.0)',
                'image_credit_url' => 'https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis',
                'references' => [
                    ['title' => '8.1 Overview of Photosynthesis', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis'],
                    ['title' => '8.2 The Light-Dependent Reactions of Photosynthesis', 'organization' => 'OpenStax, Rice University', 'url' => 'https://openstax.org/books/biology-2e/pages/8-2-the-light-dependent-reactions-of-photosynthesis'],
                    ['title' => 'What is the Carbon Cycle?', 'organization' => 'NASA Science', 'url' => 'https://science.nasa.gov/kids/earth/what-is-the-carbon-cycle/'],
                ],
                'reading_minutes' => 7,
                'sort_order' => 3,
                'version' => 1,
                'source_code' => 'curated-open-education',
                'status' => 'published',
                'published_at' => '2026-07-14 00:00:00',
            ],
        ];
    }
}

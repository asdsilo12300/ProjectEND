<?php

namespace Tests\Unit;

use App\Support\LocalizedFieldLanguageValidator;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class LocalizedFieldLanguageValidatorTest extends TestCase
{
    public function test_it_accepts_matching_languages_in_simple_and_nested_fields(): void
    {
        LocalizedFieldLanguageValidator::validateOrFail([
            'name_en' => 'Aphid',
            'name_th' => 'เพลี้ยอ่อน',
            'signs_en' => ['Curled leaves'],
            'signs_th' => ['ใบม้วนงอ'],
            'sources' => [[
                'label_en' => 'Plant directory',
                'label_th' => 'ฐานข้อมูลพืช',
                'url' => 'https://example.com',
            ]],
        ]);

        $this->assertTrue(true);
    }

    public function test_it_reports_each_field_using_the_wrong_language(): void
    {
        try {
            LocalizedFieldLanguageValidator::validateOrFail([
                'summary_en' => 'เพลี้ยอ่อนดูดน้ำเลี้ยงพืช',
                'summary_th' => 'Aphids feed on plant sap',
                'care_th' => ['Water regularly'],
                'sources' => [['label_en' => 'แหล่งข้อมูล', 'label_th' => 'Reference']],
            ]);
            $this->fail('Expected localized language validation to fail.');
        } catch (ValidationException $exception) {
            $errors = $exception->errors();
            $this->assertArrayHasKey('summary_en', $errors);
            $this->assertArrayHasKey('summary_th', $errors);
            $this->assertArrayHasKey('care_th.0', $errors);
            $this->assertArrayHasKey('sources.0.label_en', $errors);
            $this->assertArrayHasKey('sources.0.label_th', $errors);
        }
    }
}

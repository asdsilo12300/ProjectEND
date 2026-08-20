<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IssueReport;
use App\Models\IssueReportAttachment;
use App\Services\IssueReportPresenter;
use App\Services\PrivateMediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class IssueReportController extends Controller
{
    public function __construct(private readonly PrivateMediaStorage $storage, private readonly IssueReportPresenter $presenter) {}

    public function index(Request $request): JsonResponse
    {
        $reports = IssueReport::query()
            ->where('reporter_id', $request->user()->id)
            ->withCount('attachments')->with(['updates' => fn ($query) => $query->latest()->limit(1)])
            ->latest()->paginate(10);
        $reports->setCollection($reports->getCollection()->map(fn ($report) => $this->presenter->present($report)));
        return response()->json($reports);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['required', Rule::in(IssueReport::CATEGORIES)],
            'subject' => ['required', 'string', 'max:160'],
            'description' => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:8192'],
        ]);

        $user = $request->user();
        $report = DB::transaction(function () use ($request, $validated, $user): IssueReport {
            $report = IssueReport::query()->create([
                'reference_code' => $this->referenceCode(),
                'reporter_id' => $user->id,
                'reporter_username' => $this->plain($user->username, 255),
                'reporter_email' => $this->plain($user->email, 255),
                'category' => $validated['category'],
                'subject' => $this->plain($validated['subject'], 160),
                'description' => $this->plain($validated['description'], 10000, true),
                'status' => 'new',
            ]);

            foreach ($request->file('attachments', []) as $file) {
                $dimensions = @getimagesize($file->getRealPath()) ?: [null, null];
                $report->attachments()->create([
                    'storage_path' => $this->storage->store($file, "issue-reports/{$user->id}/{$report->reference_code}"),
                    'original_name' => $this->plain(pathinfo($file->getClientOriginalName(), PATHINFO_BASENAME), 255),
                    'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                    'size_bytes' => $file->getSize(),
                    'width' => $dimensions[0],
                    'height' => $dimensions[1],
                    'created_at' => now(),
                ]);
            }
            return $report;
        });

        $report->load(['attachments', 'updates.admin'])->loadCount('attachments');
        return response()->json(['data' => $this->presenter->present($report, true)], 201);
    }

    public function show(Request $request, IssueReport $issueReport): JsonResponse
    {
        abort_unless($issueReport->reporter_id === $request->user()->id, 404);
        $issueReport->load(['attachments', 'updates' => fn ($query) => $query->oldest(), 'updates.admin'])->loadCount('attachments');
        return response()->json(['data' => $this->presenter->present($issueReport, true)]);
    }

    public function attachment(Request $request, IssueReport $issueReport, IssueReportAttachment $attachment)
    {
        abort_unless($attachment->issue_report_id === $issueReport->id, 404);
        abort_unless($issueReport->reporter_id === $request->user()->id || $request->user()->role === 'admin', 404);
        return response($this->storage->contents($attachment->storage_path), 200, [
            'Content-Type' => $attachment->mime_type,
            'Content-Disposition' => 'inline; filename="'.addslashes($attachment->original_name).'"',
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function referenceCode(): string
    {
        do { $code = 'RPT-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)); }
        while (IssueReport::query()->where('reference_code', $code)->exists());
        return $code;
    }

    private function plain(?string $value, int $limit, bool $multiline = false): string
    {
        $clean = trim(strip_tags(str_replace("\0", '', (string) $value)));
        if (! $multiline) $clean = preg_replace('/\s+/u', ' ', $clean) ?: $clean;
        return Str::limit($clean, $limit, '');
    }
}

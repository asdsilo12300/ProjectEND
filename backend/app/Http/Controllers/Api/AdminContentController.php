<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminContentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $contents = Content::query()
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->trim().'%';
                $query->where(fn ($nested) => $nested
                    ->where('title', 'like', $search)
                    ->orWhere('title_th', 'like', $search)
                    ->orWhere('slug', 'like', $search));
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $contents]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['version'] = 1;
        $data['source_code'] = 'admin-editor';
        $data['published_at'] = $this->publishedAt($data);
        $data['sort_order'] = ((int) Content::query()->max('sort_order')) + 1;

        $content = Content::query()->create($data);
        AdminActivityLog::record($request->user(), 'created', 'contents', $content->id, ['title' => $content->title, 'status' => $content->status]);

        return response()->json(['data' => $content], 201);
    }

    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'upload' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:8192'],
        ]);

        $file = $request->file('upload');
        $path = $file->store('content-images', 'public');
        AdminActivityLog::record($request->user(), 'uploaded', 'content-image', null, [
            'path' => $path,
            'size' => $file->getSize(),
            'mime' => $file->getMimeType(),
        ]);

        return response()->json([
            'url' => Storage::url($path),
        ], 201);
    }

    public function update(Request $request, Content $content): JsonResponse
    {
        $before = $content->only(['title', 'title_th', 'slug', 'status', 'version']);
        $data = $this->validated($request, $content);
        $data['version'] = ((int) $content->version) + 1;
        $data['published_at'] = $this->publishedAt($data, $content);
        $content->fill($data)->save();
        AdminActivityLog::record($request->user(), 'updated', 'contents', $content->id, ['before' => $before, 'after' => $content->fresh()->only(['title', 'title_th', 'slug', 'status', 'version'])]);

        return response()->json(['data' => $content->fresh()]);
    }

    public function destroy(Content $content): JsonResponse
    {
        $admin = request()->user();
        $before = $content->only(['title', 'slug', 'status', 'version']);
        $content->delete();
        AdminActivityLog::record($admin, 'deleted', 'contents', $content->id, ['before' => $before]);

        return response()->json(['message' => 'Content deleted.']);
    }

    private function validated(Request $request, ?Content $content = null): array
    {
        $title = trim((string) $request->input('title', ''));
        $titleTh = trim((string) $request->input('title_th', ''));
        $body = trim((string) $request->input('body_html', ''));
        $bodyTh = trim((string) $request->input('body_html_th', ''));

        $title = $title !== '' ? $title : $titleTh;
        $titleTh = $titleTh !== '' ? $titleTh : $title;
        $body = $body !== '' ? $body : $bodyTh;
        $bodyTh = $bodyTh !== '' ? $bodyTh : $body;

        $summary = trim((string) $request->input('summary', ''));
        $summaryTh = trim((string) $request->input('summary_th', ''));
        $summary = $summary !== '' ? $summary : $this->summaryFromHtml($body ?: $bodyTh, $title);
        $summaryTh = $summaryTh !== '' ? $summaryTh : $this->summaryFromHtml($bodyTh ?: $body, $titleTh);

        $slug = trim((string) $request->input('slug', ''));
        if ($slug === '') {
            $slug = $content?->slug ?? $this->uniqueSlug($title ?: $titleTh);
        }

        $readingMinutes = $request->input('reading_minutes');
        if (! is_numeric($readingMinutes) || (int) $readingMinutes < 1) {
            $readingMinutes = $this->estimateReadingMinutes($body ?: $bodyTh);
        }

        $request->merge([
            'slug' => $slug,
            'category' => trim((string) $request->input('category', '')) ?: ($content?->category ?? 'plant-science'),
            'icon' => trim((string) $request->input('icon', '')) ?: ($content?->icon ?? 'eco'),
            'title' => $title,
            'title_th' => $titleTh,
            'summary' => $summary,
            'summary_th' => $summaryTh,
            'body_html' => $body,
            'body_html_th' => $bodyTh,
            'reading_minutes' => (int) $readingMinutes,
            'sort_order' => is_numeric($request->input('sort_order')) ? (int) $request->input('sort_order') : ($content?->sort_order ?? 0),
        ]);

        return $request->validate([
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('contents', 'slug')->ignore($content?->id)],
            'category' => ['required', 'string', 'max:80'],
            'icon' => ['nullable', 'string', 'max:50'],
            'eyebrow' => ['nullable', 'string', 'max:255'],
            'eyebrow_th' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'title_th' => ['required', 'string', 'max:255'],
            'summary' => ['required', 'string', 'max:2000'],
            'summary_th' => ['required', 'string', 'max:2000'],
            'body_html' => ['required', 'string', 'max:100000'],
            'body_html_th' => ['required', 'string', 'max:100000'],
            'cover_image_url' => ['required_if:status,published', 'nullable', 'string', 'max:2048'],
            'cover_image_alt' => ['nullable', 'string', 'max:255'],
            'cover_image_alt_th' => ['nullable', 'string', 'max:255'],
            'image_credit' => ['nullable', 'string', 'max:255'],
            'image_credit_url' => ['nullable', 'string', 'max:2048'],
            'references' => ['required_if:status,published', 'nullable', 'array', 'min:1', 'max:20'],
            'references.*.title' => ['required_with:references', 'string', 'max:255'],
            'references.*.organization' => ['nullable', 'string', 'max:255'],
            'references.*.url' => ['required_with:references', 'url:http,https', 'max:2048'],
            'reading_minutes' => ['required', 'integer', 'between:1,60'],
            'sort_order' => ['required', 'integer', 'between:0,999'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
        ]);
    }

    private function summaryFromHtml(string $html, string $fallback): string
    {
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        return Str::limit($text !== '' ? $text : $fallback, 320, '');
    }

    private function estimateReadingMinutes(string $html): int
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
        $words = $text === '' ? 0 : count(preg_split('/\s+/u', $text) ?: []);
        $characters = mb_strlen(preg_replace('/\s+/u', '', $text) ?? '');

        return max(1, min(60, (int) ceil(max($words / 200, $characters / 700))));
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        if ($base === '') {
            $base = 'article-'.Str::lower(Str::random(8));
        }

        $candidate = $base;
        $suffix = 2;
        while (Content::query()->where('slug', $candidate)->exists()) {
            $candidate = $base.'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function publishedAt(array $data, ?Content $content = null): mixed
    {
        if ($data['status'] !== 'published') {
            return null;
        }

        return $data['published_at'] ?? $content?->published_at ?? now();
    }
}

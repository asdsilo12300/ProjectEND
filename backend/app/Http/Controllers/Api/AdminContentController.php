<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\Content;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'cover_image_url' => ['nullable', 'string', 'max:2048'],
            'cover_image_alt' => ['nullable', 'string', 'max:255'],
            'cover_image_alt_th' => ['nullable', 'string', 'max:255'],
            'image_credit' => ['nullable', 'string', 'max:255'],
            'image_credit_url' => ['nullable', 'string', 'max:2048'],
            'references' => ['nullable', 'array', 'max:20'],
            'references.*.title' => ['required_with:references', 'string', 'max:255'],
            'references.*.organization' => ['nullable', 'string', 'max:255'],
            'references.*.url' => ['required_with:references', 'url:http,https', 'max:2048'],
            'reading_minutes' => ['required', 'integer', 'between:1,60'],
            'sort_order' => ['required', 'integer', 'between:0,999'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
        ]);
    }

    private function publishedAt(array $data, ?Content $content = null): mixed
    {
        if ($data['status'] !== 'published') {
            return null;
        }

        return $data['published_at'] ?? $content?->published_at ?? now();
    }
}

<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Any authenticated user (Admin or Committee Officer) may scan.
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'serial_number' => ['nullable', 'string', 'max:30'],
            'decoded_via' => ['required', 'in:qr,ocr,none'],
            'omr_confidence' => ['required', 'numeric', 'min:0', 'max:1'],
            'image_path' => ['sometimes', 'string'],
            'votes' => ['present', 'array'],
            'votes.*.position_id' => ['required', 'integer', 'exists:positions,id'],
            'votes.*.candidate_id' => ['nullable', 'integer', 'exists:candidates,id'],
            'votes.*.is_abstain' => ['required', 'boolean'],
        ];
    }
}

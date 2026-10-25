<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreElectionRequest extends FormRequest
{
    /**
     * BR-07: only an authenticated Admin may create/edit elections.
     * The 'admin' middleware (routes/api.php) also checks this at the
     * route level - this is a second, explicit check at the request level.
     */
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'status' => ['sometimes', 'in:draft,active,closed'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'end_date.after_or_equal' => 'The end date must be on or after the start date.',
        ];
    }
}

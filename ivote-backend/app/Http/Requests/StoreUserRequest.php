<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    private bool $legacyUsernameInput = false;

    protected function prepareForValidation(): void
    {
        if (! $this->filled('email') && $this->filled('username')) {
            $this->legacyUsernameInput = true;
            $this->merge(['email' => $this->input('username')]);
        } elseif (! $this->filled('username') && $this->filled('email')) {
            $this->merge(['username' => $this->input('email')]);
        }

        if ($this->has('year_level') && is_array($this->input('year_level'))) {
            $this->merge([
                'year_level' => implode(', ', array_values(array_filter(
                    array_map('trim', $this->input('year_level')),
                    fn (string $value) => $value !== ''
                ))),
            ]);
        }

        if (
            $this->input('role') === 'committee_officer'
            && ! $this->filled('precinct')
            && $this->filled('program')
            && $this->filled('year_level')
        ) {
            $this->merge([
                'precinct' => trim($this->input('program')) . ' - ' . trim($this->input('year_level')),
            ]);
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        $emailRules = [
            'required',
            'string',
            'max:150',
            Rule::unique('users', 'email')->ignore($userId),
            Rule::unique('users', 'username')->ignore($userId),
        ];

        if (! $this->legacyUsernameInput) {
            $emailRules[] = 'email';
        }

        return [
            'name' => ['required', 'string', 'max:100'],
            'email' => $emailRules,
            'username' => [
                'required',
                'string',
                'max:150',
                Rule::unique('users', 'username')->ignore($userId),
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => [
                'sometimes',
                'nullable',
                'string',
                'min:8',
                'max:16',
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/[0-9]/',
                'regex:/[^A-Za-z0-9]/',
                'confirmed',
            ],
            'password_confirmation' => ['sometimes', 'nullable', 'string'],
            'role' => ['required', Rule::in(['admin', 'committee_officer'])],
            'precinct' => ['nullable', 'string', 'max:100'],
            'program' => ['nullable', 'string', 'max:20'],
            'year_level' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}

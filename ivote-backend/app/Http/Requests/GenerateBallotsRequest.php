<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GenerateBallotsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'election_id' => ['required', 'integer', 'exists:elections,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'program' => ['required', 'in:BSIT,BSHM,BSE,BTVTED,BINDTECH'],
            'year_level' => ['required', 'in:2nd Year,3rd Year,4th Year'],
        ];
    }
}

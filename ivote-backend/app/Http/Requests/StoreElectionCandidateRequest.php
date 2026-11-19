<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreElectionCandidateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'party' => [
                'required',
                'string',
                'max:100',
                Rule::exists('parties', 'name')->where(
                    fn ($query) => $query->where('election_id', $this->route('election'))
                ),
            ],
            'position_id' => [
                'required',
                'integer',
                Rule::exists('positions', 'id')->where(
                    fn ($query) => $query->where('election_id', $this->route('election'))
                ),
            ],
        ];
    }
}
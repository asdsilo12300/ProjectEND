<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'currency', 'amount', 'type', 'reference_type', 'reference_id'];
}

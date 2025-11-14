-- Seed platform_betwin as the first sovereign platform
-- This maintains backward compatibility with existing 1-Stake integration

-- First, get the existing webhook configuration from system_config
DO $$ 
DECLARE
    v_webhook_url TEXT;
    v_webhook_secret TEXT := COALESCE(current_setting('app.tkoin_webhook_secret', true), '');
BEGIN
    -- Get webhook URL from system config
    SELECT value INTO v_webhook_url 
    FROM system_config 
    WHERE key = '1stake_webhook_url' 
    LIMIT 1;
    
    -- Insert platform_betwin if it doesn't exist
    INSERT INTO sovereign_platforms (
        id,
        name,
        display_name,
        description,
        webhook_url,
        webhook_secret,
        is_active,
        is_public,
        contact_email,
        support_url,
        api_key,
        rate_limit,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        'platform_betwin',
        'BetWin Casino',
        'BetWin - Flagship Tkoin Platform',
        'BetWin casino serves as the flagship application demonstrating Tkoin Protocol capabilities',
        v_webhook_url,
        v_webhook_secret,
        true,
        true,
        'support@betwin.casino',
        NULL,
        NULL,
        5000,
        '{"type": "casino", "flagship": true, "legacy_id": "1stake"}'::jsonb,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        webhook_url = EXCLUDED.webhook_url,
        webhook_secret = EXCLUDED.webhook_secret,
        updated_at = NOW();
    
    RAISE NOTICE 'Platform platform_betwin created/updated successfully';
END $$;

# CRUZE Wi-Fi Billing - RouterOS 7 REST/API preparation
# REVIEW BEFORE APPLYING. Does not delete existing ISPMan/hotspot configuration.
:local billingUser "cruze-billing"
:local billingAddress "10.111.0.10"
:local billingPassword "CHANGE_ME_STRONG_PASSWORD"

# Dedicated read/write API account, restricted to the billing server IP.
:if ([:len [/user group find name="cruze-billing-policy"]] = 0) do={
    /user group add name=cruze-billing-policy policy=api,read,write,test comment="Cruze Billing API group"
}
:if ([:len [/user find name=$billingUser]] = 0) do={
    /user add name=$billingUser group=cruze-billing-policy password=$billingPassword address=$billingAddress comment="Cruze Billing Server API"
}

# RouterOS 7 REST is exposed through www-ssl. Keep plain HTTP disabled.
# Your router must have a certificate configured for production TLS.
 /ip service set [find name=www-ssl] disabled=no address=10.111.0.10/32
 /ip service set [find name=www] disabled=yes

# Optional: confirm the existing HotSpot profile. Do not overwrite ISPMan values.
:put "Existing HotSpot servers:"
/ip hotspot print
:put "Existing HotSpot user profiles:"
/ip hotspot user profile print

:put "Cruze billing REST preparation complete."
:put "Use https://ROUTER-IP/rest from the billing server."

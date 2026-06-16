## Goal
Split the single phone-number input on the auth page into two fields: a country-code dropdown and a national-number input.

## Changes

### 1. State & validation (`src/routes/auth.tsx`)
- Replace the single `phone` state with `countryCode` (string) and `nationalNumber` (string).
- Add a `countryCodeSchema` (must be present) and update `nationalNumberSchema` (digits only, reasonable min/max length).
- Keep a helper that builds the full E.164 string (`countryCode + nationalNumber`) for Supabase calls.

### 2. UI layout
- In the "Phone" tab, replace the current single `<Input id="phone">` with a horizontal row:
  - **Left**: a `<select>` for country code, pre-filled with common codes (+1 US/CA, +44 UK, +91 India, +61 Australia, +49 Germany, +33 France, +81 Japan, +86 China, +7 Russia, +55 Brazil, +52 Mexico, +39 Italy, +34 Spain, +82 South Korea, +62 Indonesia, +65 Singapore, +971 UAE, +966 Saudi Arabia, +20 Egypt, +27 South Africa, +92 Pakistan, +94 Sri Lanka, +880 Bangladesh, +60 Malaysia, +66 Thailand, +63 Philippines, +64 New Zealand, +353 Ireland, +31 Netherlands, +46 Sweden, +47 Norway, +41 Switzerland, +43 Austria, +45 Denmark, +48 Poland, +32 Belgium, +30 Greece, +351 Portugal, +358 Finland, +420 Czech Republic, +36 Hungary, +372 Estonia, +371 Latvia, +370 Lithuania, +374 Armenia, +995 Georgia, +380 Ukraine, +375 Belarus, +373 Moldova, +994 Azerbaijan, +998 Uzbekistan, +996 Kyrgyzstan, +993 Turkmenistan, +992 Tajikistan, +976 Mongolia, +855 Cambodia, +856 Laos, +95 Myanmar, +84 Vietnam, +60 Brunei, +673 Brunei, +675 Papua New Guinea, +679 Fiji, +677 Solomon Islands, +678 Vanuatu, +682 Cook Islands, +683 Niue, +684 Samoa, +685 Samoa, +686 Kiribati, +687 New Caledonia, +688 Tuvalu, +689 French Polynesia, +690 Tokelau, +691 Micronesia, +692 Marshall Islands, +850 North Korea, +852 Hong Kong, +853 Macau, +855 Cambodia, +856 Laos, +880 Bangladesh, +886 Taiwan, +960 Maldives, +961 Lebanon, +962 Jordan, +963 Syria, +964 Iraq, +965 Kuwait, +966 Saudi Arabia, +967 Yemen, +968 Oman, +970 Palestine, +972 Israel, +973 Bahrain, +974 Qatar, +975 Bhutan, +976 Mongolia, +977 Nepal, +992 Tajikistan, +993 Turkmenistan, +994 Azerbaijan, +995 Georgia, +996 Kyrgyzstan, +998 Uzbekistan). Default to +1.
  - **Right**: `<Input>` for the national number, `inputMode="numeric"`, placeholder like "415 555 1234".
- On submit, combine both values into E.164 and call `signInWithOtp` exactly as today.
- Update the "Sent to" line under the OTP input to show the combined number.
- Ensure `resetPhoneFlow` clears both fields.

### 3. No other files touched
- Database, auth providers, and existing email/Google/Apple flows remain unchanged.
- The OTP verification step stays a single 6-digit input.
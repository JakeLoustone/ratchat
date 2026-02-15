# Ratchat Requirements

## Security
- No peer-to-peer - Central Server/Server Relay
- End to End Encryption
    - Wrapper function, encrypt message, and then per client delivery
- Moderation
    - IP ban - config
    - Timeout?
    - Delete Message?
    - import library for banned words(nicknames)
    - custom banned word list - config
    - Set Nick (change a users nickname and prevent them from changing it?)
    - import library for especially egregious words
    - "Slow mode" (?)
    - Announce (Set an announce message to display to all users after welcome message)
        - Welcome Message - config
        - Moderator Message

## Usage
- URL Navigation (domain/ratchat)
- Single Room, multiple users
- Nickname changing on-the-fly (/nick alias /chrat)
- Color Picker? (Static list and/or hexcode)
    - #hexnick - type enforcement on #hex via len 
- clear chat command (/clear) - client side


## Identity
- Nickname Reservation
    - no spaces
    - no admin names
    - mod/admin append prefix/suffix
    - no ecto names
    - limit length 16-20chars
    - ascii only
- GUID export functionality?
- Simple onboarding process
- User listing/status (AFK?) (?)
    - connected to chat, selected nickname - shows in list
    - AFK Flag command (/away)
    - Status Command (/status <string>) - enforce type checking
    

## Messages
- Store last X messages for display on join (configurable?)
- Author (GUID)
- Timestamp
- Size limit (Configurable 255 char default?)
- "Deletable" (flag setting)
- Welcome Message (Config set)
- license - most likely MIT?
- ascii only


## Display
- sizing? automatic
- Set Background Color (?) - client side
- Choose font (?) - client side

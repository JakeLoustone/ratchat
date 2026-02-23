- **NEW USER**
    - ***PAGE LOAD***
        - [ ] Receives Welcome message

        - *ANNOUNCEMENT SPLIT*
            - [ ] Receives an announcement if announcement
            - [ ] doesn't receive an announcement if no announcement

        - [ ] loads emotes into local ram
        - [ ] nickname warning
        - [ ] gdpr warning
        - [ ] new user connected logged in console
        - [ ] uList received and loaded in status bar (lurker count increases)

        - MESSAGE HISTORY SPLIT
            - [ ] receives no msg history if none
            - [ ] receives a msg history if msg history

    - ***FUNCTION TESTING***
        - [ ] receives new messages from other users
            - [ ] Emote works
        - [ ] receives user listing updates

        - *USER LISTING SPLIT*
            - [ ] alphabetical sorting (Alice/Bob/Charlie/Debra)
                - [ ] user join
                - [ ] user leave
                - [ ] user afk

            - [ ] lurker join
            - [ ] lurker leave

        - [ ] receives new announcements
        - [ ] receives and respects delete commands
        - [ ] attempting to send messages: "system: please set your nickname with /chrat \<nickname> before chatting" | INPUT CLEAR

    - ***COMMAND TESTING***
        - [ ] /help | displays list | INPUT CLEAR
        - [ ] /clear | clears message box | INPUT CLEAR
        - [ ] /h | displays list | INPUT CLEAR
        - [ ] /clr | clears message box | INPUT CLEAR
        - [ ] /commands | displays list | INPUT CLEAR

        - [ ] /color | "system: please use /chrat \<nickname> before trying to set a color" | INPUT CLEAR
        - [ ] /color foobar | "system: please use /chrat \<nickname> before trying to set a color" | INPUT CLEAR
        - [ ] /color #2D9C59 | "system: please use /chrat \<nickname> before trying to set a color" | INPUT CLEAR
        - [ ] /colour | "system: lern to speak american" | INPUT STAYS
        - [ ] /colour foobar | "system: lern to speak american" | INPUT STAYS

        - [ ] /afk | "system: please use /chrat \<nickname> before trying to go afk lmao" | INPUT CLEAR
        - [ ] /afk foobar | "system: please use /chrat \<nickname> before trying to go afk lmao" | INPUT CLEAR

        - [ ] /status | "system: please use /chrat \<nickname> before trying to facebook post" | INPUT CLEAR
        - [ ] /status foobar | "system: please use /chrat \<nickname> before trying to facebook post" | INPUT CLEAR
        - [ ] /me | "system: please use /chrat \<nickname> before trying to facebook post" | INPUT CLEAR
        - [ ] /me foobar | "system: please use /chrat \<nickname> before trying to facebook post" | INPUT CLEAR

        - [ ] /gdpr info | displays list | INPUT CLEAR
        - [ ] /gdpr ip | displays message | INPUT CLEAR
        - [ ] /gdpr export | "system: no server stored data" | INPUT CLEAR
        - [ ] /gdpr delete | "system: no server stored data" | INPUT CLEAR
        - [ ] /gdpr foobar | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS
        - [ ] /gdpr | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS

        - [ ] /announce | "naughty naughty" | INPUT CLEAR
        - [ ] /announce foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /announcement | "naughty naughty" | INPUT CLEAR
        - [ ] /announcement foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /ban | "naughty naughty" | INPUT CLEAR
        - [ ] /ban foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /timeout | "naughty naughty" | INPUT CLEAR
        - [ ] /timeout foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /to | "naughty naughty" | INPUT CLEAR
        - [ ] /to foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /delete | "naughty naughty" | INPUT CLEAR
        - [ ] /delete foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /emotes | "naughty naughty" | INPUT CLEAR
        - [ ] /emotes foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /emote | "naughty naughty" | INPUT CLEAR
        - [ ] /emote foobar | "naughty naughty"| INPUT CLEAR

        - [ ] /foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /foobar foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clr foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clear foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /background foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bg foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bgreset foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export | "you ain't got no ID, you ain't gettin in this bar." | INPUT CLEAR

        - *BACKGROUND SPLIT*

            - NO BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | 'no background to reset'

            - BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | removes background back to white "background reset" | INPUT CLEAR

        - *NICK IMPORT SPLIT*

            - [ ] /import | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import foobar | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import f6bd649c-9b48-4793-9e21-9dd36b93191d | INPUT CLEAR
                - [ ] "system: identity changed to testing"
                - [ ] announcement "testing connected"
                - [ ] userlist updated with testing entry

            - [ ] /nick gravebreak | "can't be named that" | INPUT STAYS
            - [ ] /nick admin | "can't be named that" | INPUT STAYS
            - [ ] /nick 'racial' | "can't be named that" | INPUT STAYS
            - [ ] /nick 'rac.ial' | "can't be named that" | INPUT STAYS

            - [ ] /nick a | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick areallyreallyreallylongnickanem | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick firefox | "nickname is already in use" | INPUT STAYS
            - [ ] /nick test ing | "system: no spaces in usernames" | INPUT STAYS
            - [ ] /nick \<i>testing\</i> | "itestingi has joined teh ratchat" | INPUT CLEAR
    - **DISCONNECT FLOW**
        - [ ] console log user disconnected
        - [ ] lurker count decreases

- **RETURNING USER**
    - ***PAGE LOAD***
        - [ ] Receives Welcome message

        - *ANNOUNCEMENT SPLIT*
            - [ ] Receives an announcement if announcement
            - [ ] doesn't receive an announcement if no announcement

        - [ ] welcome back message
        - [ ] loads emotes into local ram
        - [ ] new user connected logged in console
        - [ ] uList received and loaded in status bar

        - MESSAGE HISTORY SPLIT
            - [ ] receives no msg history if none
            - [ ] receives a msg history if msg history
        
        - [ ] returning user announcement

    - ***FUNCTION TESTING***
        - [ ] receives new messages from other users
            - [ ] Emote works
        - [ ] receives user listing updates

        - *USER LISTING SPLIT*
            - [ ] alphabetical sorting (Alice/Bob/Charlie/Debra)
                - [ ] user join
                - [ ] user leave
                - [ ] user afk

            - [ ] lurker join
            - [ ] lurker leave

        - [ ] receives new announcements
        - [ ] receives and respects delete commands

        - *MESSAGE TESTING SPLIT*
            - [ ] send a blank message - not sent | INPUT STAYS
            - [ ] send message "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." "system: sorry your message is too long lmao" | INPUT STAYS
            - [ ] send 'racial' "watch your profamity" | INPUT STAYS
            - [ ] send 'rac ial' "watch your profamity" | INPUT STAYS
            - [ ] send 'rac.ial' "watch your profamity" | INPUT STAYS
            - [ ] send 'hello' | INPUT CLEAR
                - [ ] time stamp correct
                - [ ] author correct
                - [ ] has message ID
                - [ ] last message time updates
            - [ ] send 'hello' again too fast "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS
            - [ ] send 'hello' while timed out "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS

    - ***COMMAND TESTING***
        - [ ] /help | displays list | INPUT CLEAR
        - [ ] /clear | clears message box | INPUT CLEAR
        - [ ] /h | displays list | INPUT CLEAR
        - [ ] /clr | clears message box | INPUT CLEAR
        - [ ] /commands | displays list | INPUT CLEAR

        - [ ] /color | 'invalid hex code. please use format #RRGGBB' | INPUT STAYS
        - [ ] /color foobar | 'invalid hex code. please use format #RRGGBB' | INPUT STAYS
        - [ ] /color #2D9C59 | 'system: your color has been updated to #RRGGBB' | INPUT CLEAR
        - [ ] /color #42A2C2 | within 5 seconds "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS
        - [ ] /color #2D9C59 | while timed out "system: you're in timeout rn" | INPUT STAYS
        - [ ] /colour | "system: lern to speak american" | INPUT STAYS
        - [ ] /colour foobar | "system: lern to speak american" | INPUT STAYS

        - [ ] /afk | if user is not afk "you've gone afk" | INPUT CLEAR
        - [ ] /afk | if users is afk "welcome back \<nickname> | INPUT CLEAR
        - [ ] /afk foobar | if user is not afk "you've gone afk" | INPUT CLEAR
        - [ ] /afk foobar | if users is afk "welcome back \<nickname> | INPUT CLEAR
        - [ ] /afk | if user is in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /status "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." | "system: tl;dr - set something shorter" | INPUT STAYS
        - [ ] /status | "your status is now:" | INPUT CLEAR
        - [ ] /status 'hello' | "your status is now: hello" | INPUT CLEAR
        - [ ] /status 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /me "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." | "system: tl;dr - set something shorter" | INPUT STAYS
        - [ ] /me | "your status is now:" | INPUT CLEAR
        - [ ] /me 'hello' | "your status is now: hello" | INPUT CLEAR
        - [ ] /me 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /gdpr info | displays list | INPUT CLEAR
        - [ ] /gdpr ip | displays message | INPUT CLEAR
        - [ ] /gdpr export | ```{
            "guid": guid,
            "nick": color + nick,
            "status": status,
            "isMod": false,
            "lastMessage": time,
            "isAfk": false,
            "lastChanged": time
        }``` | INPUT CLEAR
        - [ ] /gdpr delete | INPUT CLEAR
            - [ ] user removed from users.json
            - [ ] user removed from active listing
            - [ ] "goodbye is ur data"
            - [ ] local storage cleared
            - [ ] "reloading..."
            - [ ] window reloads
            - [ ] if background set, now cleared
            - [ ] if multiple sessions, all removed
        - [ ] /gdpr foobar | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS
        - [ ] /gdpr | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS

        - [ ] /announce | "naughty naughty" | INPUT CLEAR
        - [ ] /announce foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /announcement | "naughty naughty" | INPUT CLEAR
        - [ ] /announcement foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /ban | "naughty naughty" | INPUT CLEAR
        - [ ] /ban foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /timeout | "naughty naughty" | INPUT CLEAR
        - [ ] /timeout foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /to | "naughty naughty" | INPUT CLEAR
        - [ ] /to foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /delete | "naughty naughty" | INPUT CLEAR
        - [ ] /delete foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /emotes | "naughty naughty" | INPUT CLEAR
        - [ ] /emotes foobar | "naughty naughty" | INPUT CLEAR
        - [ ] /emote | "naughty naughty" | INPUT CLEAR
        - [ ] /emote foobar | "naughty naughty"| INPUT CLEAR
        - [ ] /foobar "system: that's not a command lol" | INPUT STAYS

        - [ ] /foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /foobar foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clr foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clear foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /background foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bg foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bgreset foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export | "Your GUID is 1230012491240412042" | INPUT CLEAR

        - *BACKGROUND SPLIT*

            - NO BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | 'no background to reset'

            - BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | removes background back to white "background reset" | INPUT CLEAR

        - *NICK IMPORT SPLIT*

            - [ ] /import | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import foobar | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import f6bd649c-9b48-4793-9e21-9dd36b93191d | INPUT CLEAR
                - [ ] "system: identity changed to testing"
                - [ ] announcement "oldNick disconnected"
                - [ ] announcement "testing connected"
                - [ ] userlist updated with testing entry

            - [ ] /nick gravebreak | "can't be named that" | INPUT STAYS
            - [ ] /nick admin | "can't be named that" | INPUT STAYS
            - [ ] /nick 'racial' | "can't be named that" | INPUT STAYS
            - [ ] /nick 'rac.ial' | "can't be named that" | INPUT STAYS

            - [ ] /nick a | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick areallyreallyreallylongnickanem | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick firefox | "nickname is already in use" | INPUT STAYS
            - [ ] /nick test ing | "system: no spaces in usernames" | INPUT STAYS
            - [ ] /nick \<i>testing\</i> | "oldNick has changed their name to itestingi" | INPUT CLEAR
            - [ ] /nick testing | within 30 seconds "you're doing that too fast, wait ${Math.ceil(waitTime)} seconds."

    - **DISCONNECT FLOW**
        - [ ] console log user disconnected
        - [ ] 'nickname has disconnected'

- **MODERATOR**
    - ***PAGE LOAD***
        - [ ] Receives Welcome message

        - *ANNOUNCEMENT SPLIT*
            - [ ] Receives an announcement if announcement
            - [ ] doesn't receive an announcement if no announcement

        - [ ] welcome back message
        - [ ] loads emotes into local ram
        - [ ] new user connected logged in console
        - [ ] uList received and loaded in status bar

        - MESSAGE HISTORY SPLIT
            - [ ] receives no msg history if none
            - [ ] receives a msg history if msg history
        
        - [ ] returning user announcement

    - ***FUNCTION TESTING***
        - [ ] receives new messages from other users
            - [ ] Emote works
        - [ ] receives user listing updates

        - *USER LISTING SPLIT*
            - [ ] alphabetical sorting (Alice/Bob/Charlie/Debra)
                - [ ] user join
                - [ ] user leave
                - [ ] user afk

            - [ ] lurker join
            - [ ] lurker leave

        - [ ] receives new announcements
        - [ ] receives and respects delete commands

        - *MESSAGE TESTING SPLIT*
            - [ ] send a blank message - not sent | INPUT STAYS
            - [ ] send message "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." "system: sorry your message is too long lmao" | INPUT STAYS
            - [ ] send 'racial' "watch your profamity" | INPUT STAYS
            - [ ] send 'rac ial' "watch your profamity" | INPUT STAYS
            - [ ] send 'rac.ial' "watch your profamity" | INPUT STAYS
            - [ ] send 'hello' | INPUT CLEAR
                - [ ] time stamp correct
                - [ ] author correct
                - [ ] has message ID
                - [ ] last message time updates
            - [ ] send 'hello' again too fast "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS
            - [ ] send 'hello' while timed out "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS

    - ***COMMAND TESTING***
        - [ ] /help | displays list | INPUT CLEAR
        - [ ] /clear | clears message box | INPUT CLEAR
        - [ ] /h | displays list | INPUT CLEAR
        - [ ] /clr | clears message box | INPUT CLEAR
        - [ ] /commands | displays list | INPUT CLEAR

        - [ ] /color | 'invalid hex code. please use format #RRGGBB' | INPUT STAYS
        - [ ] /color foobar | 'invalid hex code. please use format #RRGGBB' | INPUT STAYS
        - [ ] /color #2D9C59 | 'system: your color has been updated to #RRGGBB' | INPUT CLEAR
        - [ ] /color #42A2C2 | within 5 seconds "system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds." | INPUT STAYS
        - [ ] /color #2D9C59 | while timed out "system: you're in timeout rn" | INPUT STAYS
        - [ ] /colour | "system: lern to speak american" | INPUT STAYS
        - [ ] /colour foobar | "system: lern to speak american" | INPUT STAYS

        - [ ] /afk | if user is not afk "you've gone afk" | INPUT CLEAR
        - [ ] /afk | if users is afk "welcome back \<nickname> | INPUT CLEAR
        - [ ] /afk foobar | if user is not afk "you've gone afk" | INPUT CLEAR
        - [ ] /afk foobar | if users is afk "welcome back \<nickname> | INPUT CLEAR
        - [ ] /afk | if user is in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /status "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." | "system: tl;dr - set something shorter" | INPUT STAYS
        - [ ] /status | "your status is now:" | INPUT CLEAR
        - [ ] /status 'hello' | "your status is now: hello" | INPUT CLEAR
        - [ ] /status 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /me "Narrator: According to all known laws of aviation, there is no way that a bee should be able to fly. Its wings are too small to get its fat little body off the ground. The bee, of course, flies anyway because bees don't care what humans think is impossible." | "system: tl;dr - set something shorter" | INPUT STAYS
        - [ ] /me | "your status is now:" | INPUT CLEAR
        - [ ] /me 'hello' | "your status is now: hello" | INPUT CLEAR
        - [ ] /me 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS

        - [ ] /gdpr info | displays list | INPUT CLEAR
        - [ ] /gdpr ip | displays message | INPUT CLEAR
        - [ ] /gdpr export | ```{
            "guid": guid,
            "nick": color + nick,
            "status": status,
            "isMod": false,
            "lastMessage": time,
            "isAfk": false,
            "lastChanged": time
        }``` | INPUT CLEAR
        - [ ] /gdpr delete | INPUT CLEAR
            - [ ] user removed from users.json
            - [ ] user removed from active listing
            - [ ] "goodbye is ur data"
            - [ ] local storage cleared
            - [ ] "reloading..."
            - [ ] window reloads
            - [ ] if background set, now cleared
            - [ ] if multiple sessions, all removed
        - [ ] /gdpr foobar | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS
        - [ ] /gdpr | "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr" | INPUT STAYS

        - [ ] /announce | "announcement cleared" | INPUT CLEAR
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement
        - [ ] /announce 'hello' | INPUT CLEAR
            - [ ] all users recieve "announcement: hello"
            - [ ] new user recieve "announcement: hello"
        - [ ] /announce | while in timeout  "system: you're in timeout rn" | INPUT STAYS
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement
        - [ ] /announce 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement
        - [ ] /announcement | "announcement cleared" | INPUT CLEAR
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement
        - [ ] /announcement 'hello' | INPUT CLEAR
            - [ ] all users recieve "announcement: hello"
            - [ ] new user recieve "announcement: hello"
        - [ ] /announcement | while in timeout  "system: you're in timeout rn" | INPUT STAYS
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement
        - [ ] /announcement 'hello' | while in timeout "system: you're in timeout rn" | INPUT STAYS
            - [ ] no users recieve announcement
            - [ ] no new users recieve announcement

        - [ ] /ban | "missing target | INPUT STAYS
        - [ ] /ban foobar | "foobar has been banned" | INPUT CLEAR

        - [ ] /timeout | "missing target" | INPUT STAYS
        - [ ] /timeout foobar | "couldn't find user with nickname foobar" | INPUT STAYS
        - [ ] /timeout \<nickname> | if user has no messages | INPUT CLEARS
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 300 seconds
        - [ ] /timeout \<nickname> | if user has messages | INPUT CLEARS
            - [ ] for each message moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 300 seconds
        - [ ] /timeout \<nickname> 10 | if user has no messages | INPUT CLEARS
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 10 seconds
        - [ ] /timeout \<nickname> 10 | if user has messages | INPUT CLEARS
            - [ ] for each message moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 10 seconds
        - [ ] /to | "missing target" | INPUT STAYS
        - [ ] /to foobar | "couldn't find user with nickname foobar" | INPUT STAYS
        - [ ] /timeout \<nickname> | if user has no messages | INPUT CLEARS
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 300 seconds
        - [ ] /to \<nickname> | if user has messages | INPUT CLEARS
            - [ ] for each message moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 300 seconds
        - [ ] /to \<nickname> 10 | if user has no messages | INPUT CLEARS
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 10 seconds
        - [ ] /to \<nickname> 10 | if user has messages | INPUT CLEARS
            - [ ] for each message moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
            - [ ] to all users "\<nickname> has been banned"
            - [ ] \<nickanme> can't send messages for 10 seconds

        - [ ] /delete | "please provide message ID" | INPUT STAYS
        - [ ] /delete foobar | "please provide message ID" | INPUT STAYS
        - [ ] /delete 1 | if msg ID 1 exists and is in history array | INPUT CLEARS
            - [ ] moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
        - [ ] /delete 1 | if msg ID 1 exists | INPUT CLEARS
            - [ ] moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages
        - [ ] /delete 1 | if msg ID 1 does not exist | INPUT CLEARS
            - [ ] moderator recieves "message ID \<ID> deleted"
            - [ ] all users remove messages
            - [ ] new users don't receive messages


        - [ ] /emotes | "reloading emotes from config..." | INPUT CLEAR
            - [ ] console log | cached X global emotes
            - [ ] all users can use emotes
            - [ ] moderator "emotes loaded"
        - [ ] /emotes foobar | "doesn't look like a 7tv ID" | INPUT STAYS
        - [ ] /emotes \<7tvID> | "fetching new emote set \<7tvID>" | INPUT CLEAR
            - [ ] console log | cached X global emotes
            - [ ] all users can use new emotes
            - [ ] moderator "emotes loaded"
        - [ ] /emote | "reloading emotes from config..." | INPUT CLEAR
            - [ ] console log | cached X global emotes
            - [ ] all users can use emotes
            - [ ] moderator "emotes loaded"
        - [ ] /emote foobar | "doesn't look like a 7tv ID" | INPUT STAYS
        - [ ] /emote \<7tvID> | "fetching new emote set \<7tvID>" | INPUT CLEAR
            - [ ] console log | cached X global emotes
            - [ ] all users can use new emotes
            - [ ] moderator "emotes loaded"
        
        - [ ] /foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /foobar foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clr foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /clear foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /background foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bg foobar | "system: that's not a command lol" | INPUT STAYS
        - [ ] /bgreset foobar | "system: that's not a command lol" | INPUT STAYS

        - [ ] /export | "Your GUID is 1230012491240412042" | INPUT CLEAR

        - *BACKGROUND SPLIT*

            - NO BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | 'no background to reset'

            - BACKGROUND SET:
                - [ ] /background | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /background | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /background | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bg | opens file explorer, selects non image file, does not work | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects no file and closes, no new background | INPUT CLEAR
                - [ ] /bg | opens file explorer, selects image file, loads new background | INPUT CLEAR

                - [ ] /bgreset | removes background back to white "background reset" | INPUT CLEAR

        - *NICK IMPORT SPLIT*

            - [ ] /import | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import foobar | "system: not a valid GUID" | INPUT STAYS
            - [ ] /import f6bd649c-9b48-4793-9e21-9dd36b93191d | INPUT CLEAR
                - [ ] "system: identity changed to testing"
                - [ ] announcement "oldNick disconnected"
                - [ ] announcement "testing connected"
                - [ ] userlist updated with testing entry

            - [ ] /nick gravebreak | "can't be named that" | INPUT STAYS
            - [ ] /nick admin | "can't be named that" | INPUT STAYS
            - [ ] /nick 'racial' | "can't be named that" | INPUT STAYS
            - [ ] /nick 'rac.ial' | "can't be named that" | INPUT STAYS

            - [ ] /nick a | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick areallyreallyreallylongnickanem | "nickname must be between 2 and 15 characters" | INPUT STAYS
            - [ ] /nick firefox | "nickname is already in use" | INPUT STAYS
            - [ ] /nick test ing | "system: no spaces in usernames" | INPUT STAYS
            - [ ] /nick \<i>testing\</i> | "oldNick has changed their name to itestingi" | INPUT CLEAR
            - [ ] /nick testing | within 30 seconds "you're doing that too fast, wait ${Math.ceil(waitTime)} seconds."

    - **DISCONNECT FLOW**
        - [ ] console log user disconnected
        - [ ] 'nickname has disconnected'

### Mermaid Charts

##### Sender/Receiver flow
```mermaid
sequenceDiagram
    autonumber
    actor Sender as User A (Writer/Sender)
    participant ClientA as Client A (UI)
    participant Server as Server (Node)
    participant Services as Services (Mod/ID/Hist)
    participant ClientB as Client B (UI)
    actor Receiver as User B (Reader/Receiver)

    Note over ClientA, ClientB: 1. INPUT PHASE
    Sender->>ClientA: Types "Hello" & Hits Enter
    ClientA->>ClientA: Clears Input Field
    ClientA->>Server: Emit 'message' ("Hello")
    
    Note over ClientA: User A sees nothing yet(Waiting for Server Relay)

    Note over Server, Services: 2. PROCESSING PHASE
    rect rgb(180, 100, 180)
        Server->>Services: Validation Pipeline
        Services-->>Server: Result: OK / Sanitized
        Server->>Services: Add to History
    end

    Note over Server, ClientB: 3. BROADCAST PHASE
    par Fan Out
        Server->>ClientA: Emit 'message' 
        Server->>ClientB: Emit 'message' 
    end

    Note over ClientA, ClientB: 4. RENDER PHASE
    ClientB->>ClientB: Parse JSON
    ClientB->>Receiver: Render "User A: Hello"
    
    ClientA->>ClientA: Parse JSON
    ClientA->>Sender: Render "Me: Hello"
```

##### App UML

```mermaid
classDiagram
    class SocketServer {
        +start()
        +handleConnection(socket)
        +handleMessage(socket, data)
        +handleCommand(socket, cmd)
    }

    class IdentityService {
        -users: Map<ID, Profile>
        -mods: Set<GUID>
        +resolveUser(payload)
        +changeNick(newNick)
        +isMod(guid)
    }

    class ModerationService {
        -bannedIps: Set<IP>
        -slowMode: Map<GUID, Time>
        +isBanned(ip)
        +checkSlowMode(guid)
        +filterProfanity(text)
    }

    class MessageHistoryService {
        -buffer: Message[] (Max 15-50)
        +addMessage(msg)
        +getRecent()
        +deleteMessage(id)
    }

    SocketServer --> IdentityService : Managed Identity
    SocketServer --> ModerationService : Enforces Rules
    SocketServer --> MessageHistoryService : Stores Context
```

##### Delete Message Flow

```mermaid
flowchart LR
    Admin[Admin: /delete msgID] --> Server
    Admin --> Client1[Send client request to delete msgID]
    Server --> Search[Search History Array for msgID]
    Search --> Found{Found?}
    Found -- Yes --> Update[Clear msg.content, drop from history array]
    Update --> Broadcast[Broadcast 'delete_event' to All]
    Found -- No --> Error[Log: Message already cycled out]
    Broadcast --> Client[Clients hide message]
```

##### Chat History Flow

```mermaid
sequenceDiagram
    autonumber
    participant Client as New User
    participant Server as Socket Handler
    participant History as ChatHistoryService
    Client->>Server: Handshake (Connection)
    rect rgb(180, 100, 180)
        Note over Server, History: Fetching Context
        Server->>History: getRecentMessages()
        History-->>Server: Returns Copy of Array[ ] (Max 15-50)
    end
    Server->>Client: Emit 'history' (Payload: Message[])
    Note over Client: Client renders these 15-50 messages before showing new ones.
```

##### Chat History Service

```mermaid
flowchart TD
    Start([New Message Arrives]) --> Push[Push to History Array]
    Push --> Count{Count > 15-50?}
    Count -- Yes --> Remove[Remove Oldest Message 'Array.shift']
    Remove --> UpdateMem[(Update Memory)]
    Count -- No --> UpdateMem
    UpdateMem --> Ready[Ready for Next Join]
```

##### Message Flow

```mermaid
flowchart TD
    Start([User Sends Message]) --> Validation{Input Validation}
    Validation -- "Check Mute Status" --> IsMuted{Is User Muted?}
    IsMuted -- Yes --> Drop[Drop Message]
    IsMuted -- No --> SlowMode{Check Slow Mode}
    SlowMode -- "Too Fast (< 2s)" --> WarnSlow[Emit: 'You are chatting too fast']
    SlowMode -- "OK" --> LengthCheck{Length > 255?}
    LengthCheck -- Yes --> BlockMsg[Block Message]
    BlockMsg --> ErrorLen[Emit Error: 'Message too long <255 chars']
    ErrorLen --> ClientDisplay[Client displays system error]
    LengthCheck -- No --> Filter
    Filter --> ASCII[ASCII Enforcement]
    ASCII -- "Remove Non-ASCII" --> Profanity[Profanity Check]
    Profanity -- "Match Banned Word" --> Replace[Replace with '***']
    Profanity -- "Egregious Slur" --> Error[Bigotry is not allowed in this chat]
    Profanity -- "Clean" --> Finalize
    Replace --> Finalize[Construct Message Object]
    Finalize --> Broadcast([Broadcast to All Clients])
```

##### Connection Sequence

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Server (Socket.io)
    participant ModService
    
    Client->>Server: Connect (Handshake)
    Server->>Server: Extract Client IP
    
    Server->>ModService: isBanned(IP)
    
    alt IP is Banned
        ModService-->>Server: TRUE
        Server-->>Client: Disconnect (Force Close Socket)
        Note over Client: Connection Refused
    else IP is Clean
        ModService-->>Server: FALSE
        Server->>Client: Accept Connection
        Server->>Client: Send Welcome Message
        Server->>Client: Send Announcement Message
    end
```

##### Admin Commands

```mermaid
    flowchart TD
    Admin([Admin Types Command]) --> Parse{Parse Command}
    
    %% BAN COMMAND
    Parse -- "/ban <nick>" --> ResolveUser[Find User by Nick]
    ResolveUser -- Found --> GetIP[Get User IP]
    GetIP --> AddBan[Add IP to Banned List]
    AddBan --> Kick[Disconnect Socket]
    Kick --> AnnounceBan[Broadcast: 'User has been banned']
    
    %% TIMEOUT COMMAND
    Parse -- "/timeout <nick>" --> FindUser2[Find User]
    FindUser2 -- Found --> SetFlag[Set 'isMuted' = true]
    FindUser2 --> DeleteChat[Delete Known Messages]
    SetFlag --> SetTimer[Start 5m Timer]
    SetTimer --> AnnounceTO[Broadcast: 'User timed out']
```

##### Nick/Chrat Command

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Client
    participant Server
    participant IDService as Identity Service

    User->>Client: Enters "BigBalls"
    Client->>Server: Emit 'handshake' or 'cmd_nick' ("BigBalls")
    Server->>IDService: resolveUser / changeNick

    alt Nickname is Available
        IDService->>IDService: Reserve "Bigballs"
        IDService-->>Server: Success: User Profile
        Server-->>Client: Emit 'welcome' / 'success'
        Client-->>User: Show Chat Interface
    else Nickname is Taken
        IDService-->>Server: Error: "Nickname Taken"
        Server-->>Client: Emit 'error_nick_taken'
        
        note over Client: Client stays on entry screen
        Client-->>User: Display: "Name taken, please try again"
        
        User->>Client: Enters "BigBalls69"
        Client->>Server: Emit 'handshake' ("BigBalls69")
        Server->>IDService: resolveUser / changeNick
        IDService->>IDService: Reserve 'BigBalls69'
        IDService-->>Server: Success
        Server-->>Client: Emit 'welcome message'
    end
```

##### Identity Flow

```mermaid
flowchart TD
    Start[Client Connects] --> Handshake[Emit Handshake: GUID + Nick]
    Handshake --> CheckGUID{Has GUID?}
    CheckGUID -- Yes (Returning) --> LoadProfile[Load Profile from Memory]
    LoadProfile --> LockCheck{Is Nick Locked?}
    LockCheck -- Yes (Normal) --> Success
    CheckGUID -- No (New User) --> GenGUID[Generate New GUID]
    GenGUID --> ValidateNick{Is Nick Valid & Unique?}
    ValidateNick -- Yes --> CreateProfile[Create Profile]
    CreateProfile --> Success[Join Chat & Broadcast]
    ValidateNick -- No (Taken/Invalid) --> ErrorEvent[Emit 'nick_error']
    ErrorEvent --> ClientPrompt[Client: Show 'Choose Nickname' Modal]
    ClientPrompt --> UserInput[/User Types New Nick/]
    UserInput -- Invalid Nick --> ErrorEvent
    UserInput -- Valid Nick --> Handshake
```

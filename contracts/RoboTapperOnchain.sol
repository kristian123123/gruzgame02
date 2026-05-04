// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RoboTapperOnchain {
    uint256 public constant CHECKIN_INTERVAL = 10 minutes;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant STREAK_BONUS_BPS = 1_000; // +10% per streak step

    struct Player {
        uint256 score;
        uint32 streak;
        uint64 lastCheckinSlot;
        uint32 totalCheckins;
    }

    struct LeaderboardEntry {
        address player;
        uint256 score;
    }

    mapping(address => Player) public players;
    address[] private _participants;
    mapping(address => bool) private _seen;

    event CheckedIn(address indexed player, uint256 streak, uint256 slot);
    event Tapped(address indexed player, uint256 taps, uint256 gainedPoints, uint256 totalScore, uint256 streak);

    function currentSlot() public view returns (uint256) {
        return block.timestamp / CHECKIN_INTERVAL;
    }

    function canCheckInNow(address player) public view returns (bool) {
        return players[player].lastCheckinSlot < currentSlot();
    }

    function checkIn() external {
        Player storage p = players[msg.sender];
        uint256 slot = currentSlot();
        require(p.lastCheckinSlot < slot, "Already checked in this slot");

        if (p.lastCheckinSlot + 1 == slot && p.lastCheckinSlot != 0) {
            p.streak += 1;
        } else {
            p.streak = 1;
        }

        p.lastCheckinSlot = uint64(slot);
        p.totalCheckins += 1;
        _register(msg.sender);

        emit CheckedIn(msg.sender, p.streak, slot);
    }

    function tap(uint256 tapsCount) external {
        require(tapsCount > 0 && tapsCount <= 1000, "Invalid tapsCount");

        Player storage p = players[msg.sender];
        uint256 multiplierBps = BPS_DENOMINATOR + uint256(p.streak) * STREAK_BONUS_BPS;
        uint256 gained = (tapsCount * multiplierBps) / BPS_DENOMINATOR;

        p.score += gained;
        _register(msg.sender);

        emit Tapped(msg.sender, tapsCount, gained, p.score, p.streak);
    }

    function getPlayer(
        address player
    )
        external
        view
        returns (uint256 score, uint256 streak, uint256 lastCheckinSlot, bool canCheckin, uint256 totalCheckins)
    {
        Player storage p = players[player];
        return (p.score, p.streak, p.lastCheckinSlot, canCheckInNow(player), p.totalCheckins);
    }

    function participantsCount() external view returns (uint256) {
        return _participants.length;
    }

    function getLeaderboard(uint256 limit) external view returns (LeaderboardEntry[] memory) {
        uint256 count = _participants.length;
        if (limit == 0 || limit > count) limit = count;

        LeaderboardEntry[] memory temp = new LeaderboardEntry[](count);
        for (uint256 i = 0; i < count; i++) {
            address player = _participants[i];
            temp[i] = LeaderboardEntry(player, players[player].score);
        }

        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (temp[j].score > temp[i].score) {
                    LeaderboardEntry memory swap = temp[i];
                    temp[i] = temp[j];
                    temp[j] = swap;
                }
            }
        }

        LeaderboardEntry[] memory result = new LeaderboardEntry[](limit);
        for (uint256 i = 0; i < limit; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    function _register(address player) internal {
        if (!_seen[player]) {
            _seen[player] = true;
            _participants.push(player);
        }
    }
}

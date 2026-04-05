// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DealHashRegistry
 *
 * Stores keccak256 hashes of CRM deal records on-chain.
 * Only the hash is stored — no PII or deal data leaves the CRM.
 *
 * Design decisions:
 * - One hash per (tenantId, dealId) pair — enforced by mapping key
 * - Only the contract owner (our backend signer wallet) can write records
 * - Events are emitted for every write — indexers/subgraphs can track history
 * - `verifyDeal` is a public view — anyone can verify without gas cost
 *
 * Deployment:
 *   npx hardhat run scripts/deploy.ts --network polygon-mumbai
 *
 * ABI for ethers.js is generated from compilation.
 */
contract DealHashRegistry {
    address public immutable owner;

    struct DealRecord {
        bytes32 dataHash;      // keccak256(abi.encode(deal payload))
        uint256 timestamp;     // Block timestamp at registration
        uint256 blockNumber;
    }

    // mapping: keccak256(abi.encodePacked(tenantId, dealId)) => DealRecord
    mapping(bytes32 => DealRecord) private records;

    event DealRegistered(
        string indexed tenantId,
        string indexed dealId,
        bytes32 dataHash,
        uint256 timestamp
    );

    event DealUpdated(
        string indexed tenantId,
        string indexed dealId,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 timestamp
    );

    error Unauthorized();
    error InvalidHash();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * Register or update a deal hash.
     * Can only be called by the contract owner (our backend wallet).
     *
     * @param tenantId  UUID string of the CRM tenant
     * @param dealId    UUID string of the deal
     * @param dataHash  keccak256 of the serialised deal payload
     */
    function registerDeal(
        string calldata tenantId,
        string calldata dealId,
        bytes32 dataHash
    ) external onlyOwner {
        if (dataHash == bytes32(0)) revert InvalidHash();

        bytes32 key = keccak256(abi.encodePacked(tenantId, dealId));
        DealRecord storage rec = records[key];

        if (rec.timestamp == 0) {
            // First registration
            rec.dataHash    = dataHash;
            rec.timestamp   = block.timestamp;
            rec.blockNumber = block.number;
            emit DealRegistered(tenantId, dealId, dataHash, block.timestamp);
        } else {
            // Update (deal amended before finalisation)
            bytes32 oldHash = rec.dataHash;
            rec.dataHash    = dataHash;
            rec.timestamp   = block.timestamp;
            rec.blockNumber = block.number;
            emit DealUpdated(tenantId, dealId, oldHash, dataHash, block.timestamp);
        }
    }

    /**
     * Verify that a given hash matches what is stored on-chain.
     * Returns true if the hashes match and a record exists.
     *
     * @param tenantId  UUID string of the CRM tenant
     * @param dealId    UUID string of the deal
     * @param dataHash  keccak256 hash to verify against
     */
    function verifyDeal(
        string calldata tenantId,
        string calldata dealId,
        bytes32 dataHash
    ) external view returns (bool isValid, uint256 registeredAt, uint256 atBlock) {
        bytes32 key = keccak256(abi.encodePacked(tenantId, dealId));
        DealRecord storage rec = records[key];
        isValid      = rec.dataHash == dataHash && rec.timestamp > 0;
        registeredAt = rec.timestamp;
        atBlock      = rec.blockNumber;
    }

    /**
     * Retrieve the stored record for a deal (no hash comparison).
     */
    function getDealRecord(
        string calldata tenantId,
        string calldata dealId
    ) external view returns (bytes32 dataHash, uint256 timestamp, uint256 blockNumber) {
        bytes32 key = keccak256(abi.encodePacked(tenantId, dealId));
        DealRecord storage rec = records[key];
        dataHash    = rec.dataHash;
        timestamp   = rec.timestamp;
        blockNumber = rec.blockNumber;
    }
}

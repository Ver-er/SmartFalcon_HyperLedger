package main

import (
    "encoding/json"
    "fmt"
    "log"

    "github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// AssetTracker provides functions for managing financial assets
type AssetTracker struct {
    contractapi.Contract
}

// Asset represents a financial account with required attributes
type Asset struct {
    DEALERID     string `json:"DEALERID"`
    MSISDN       string `json:"MSISDN"`
    MPIN         string `json:"MPIN"`
    BALANCE      int    `json:"BALANCE"`
    STATUS       string `json:"STATUS"`
    TRANSAMOUNT  int    `json:"TRANSAMOUNT"`
    TRANSTYPE    string `json:"TRANSTYPE"`
    REMARKS      string `json:"REMARKS"`
}

// CreateAsset creates a new asset in the world state
func (a *AssetTracker) CreateAsset(ctx contractapi.TransactionContextInterface, assetID, dealerID, msisdn, mpin string, balance int, status string, transAmount int, transType, remarks string) error {
    // Check if asset already exists
    exists, err := a.AssetExists(ctx, assetID)
    if err != nil {
        return err
    }
    if exists {
        return fmt.Errorf("the asset %s already exists", assetID)
    }

    asset := Asset{
        DEALERID:    dealerID,
        MSISDN:      msisdn,
        MPIN:        mpin,
        BALANCE:     balance,
        STATUS:      status,
        TRANSAMOUNT: transAmount,
        TRANSTYPE:   transType,
        REMARKS:     remarks,
    }

    assetJSON, err := json.Marshal(asset)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(assetID, assetJSON)
}

// ReadAsset reads an asset from the world state
func (a *AssetTracker) ReadAsset(ctx contractapi.TransactionContextInterface, assetID string) (*Asset, error) {
    assetJSON, err := ctx.GetStub().GetState(assetID)
    if err != nil {
        return nil, fmt.Errorf("failed to read asset %s: %v", assetID, err)
    }
    if assetJSON == nil {
        return nil, fmt.Errorf("asset %s does not exist", assetID)
    }

    var asset Asset
    err = json.Unmarshal(assetJSON, &asset)
    if err != nil {
        return nil, err
    }

    return &asset, nil
}

// UpdateAsset updates an existing asset's values
func (a *AssetTracker) UpdateAsset(ctx contractapi.TransactionContextInterface, assetID string, balance int, status, transType, remarks string, transAmount int) error {
    // Check if asset exists
    asset, err := a.ReadAsset(ctx, assetID)
    if err != nil {
        return err
    }

    // Update asset values
    asset.BALANCE = balance
    asset.STATUS = status
    asset.TRANSAMOUNT = transAmount
    asset.TRANSTYPE = transType
    asset.REMARKS = remarks

    assetJSON, err := json.Marshal(asset)
    if err != nil {
        return err
    }

    return ctx.GetStub().PutState(assetID, assetJSON)
}

// GetAllAssets queries the world state to return all assets
func (a *AssetTracker) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
    // Range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
    resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()

    var assets []*Asset
    for resultsIterator.HasNext() {
        queryResponse, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }

        var asset Asset
        err = json.Unmarshal(queryResponse.Value, &asset)
        if err != nil {
            return nil, err
        }
        assets = append(assets, &asset)
    }

    return assets, nil
}

// GetAssetHistory retrieves the transaction history for an asset
func (a *AssetTracker) GetAssetHistory(ctx contractapi.TransactionContextInterface, assetID string) ([]*Asset, error) {
    resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
    if err != nil {
        return nil, err
    }
    defer resultsIterator.Close()

    var history []*Asset
    for resultsIterator.HasNext() {
        response, err := resultsIterator.Next()
        if err != nil {
            return nil, err
        }

        var asset Asset
        if len(response.Value) > 0 {
            err = json.Unmarshal(response.Value, &asset)
            if err != nil {
                return nil, err
            }
            history = append(history, &asset)
        }
    }

    return history, nil
}

// AssetExists returns true when asset with given ID exists in world state
func (a *AssetTracker) AssetExists(ctx contractapi.TransactionContextInterface, assetID string) (bool, error) {
    assetJSON, err := ctx.GetStub().GetState(assetID)
    if err != nil {
        return false, fmt.Errorf("failed to read asset %s: %v", assetID, err)
    }

    return assetJSON != nil, nil
}

func main() {
    assetChaincode, err := contractapi.NewChaincode(&AssetTracker{})
    if err != nil {
        log.Panicf("Error creating asset tracker chaincode: %v", err)
    }

    if err := assetChaincode.Start(); err != nil {
        log.Panicf("Error starting asset tracker chaincode: %v", err)
    }
}

// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering loading time distribution data
 *
 * @module js/epBalancingTimeDistributionDataService
 */

// import AwIcon from 'viewmodel/AwIconViewModel';
import epBalancingService from 'js/epBalancingService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import epBalancingLabelsService from 'js/epBalancingLabelsService';

/**
  * @param {*} props context for render function interpolation
  * @returns {Promise} react component
  */
export function loadTimeDistribution( uid ) {
    return epBalancingService.loadTimeDistribution( uid ).then( ( { responseStations, relatedData } ) => {
        const stations = _.filter( _.map( responseStations, responseStation => {
            const station = cdm.getObject( responseStation.uid );
            let processResources = [];
            if( station.props && station.props.Mfg0processResources && station.props.Mfg0processResources.dbValues.length > 0 ) {
                const stationProcessResources = station.props.Mfg0processResources.dbValues;
                processResources = _.map( stationProcessResources, prUid => {
                    const pvData = relatedData[prUid].additionalPropertiesMap2;
                    const weighted = epBalancingLabelsService.stringToFloat( pvData.weighted[0] );
                    delete pvData.weighted;
                    const productVariants = _.map( pvData, ( time, pvUid ) => ( {
                        modelObject: cdm.getObject( pvUid ),
                        time: epBalancingLabelsService.stringToFloat( time[0] ),
                        probability: epBalancingLabelsService.stringToFloat( relatedData[pvUid].additionalPropertiesMap2.probability[0] * 100 )
                    } ) );

                    return {
                        modelObject: cdm.getObject( prUid ),
                        weighted,
                        productVariants
                    };
                } );
            }
            return {
                modelObject: station,
                taktTime: epBalancingLabelsService.stringToFloat( station.props.elb0taktTime.dbValues[0] ),
                cycleTime: epBalancingLabelsService.stringToFloat( station.props.elb0cycleTime.dbValues[0] ),
                processResources
            };
        } ), station => station.processResources.length > 0 );

        return { stations };
    } );
}


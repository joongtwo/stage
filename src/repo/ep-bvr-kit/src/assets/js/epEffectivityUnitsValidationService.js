// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/epEffectivityUnitsValidationService
 */



let _integerMaxValue = 2147483647;

export function validateUnitsEntered( data ) {
    let input = data.units.dbValue;
    data.units.dbValue = input.toUpperCase();

    let normalizedInput = input.replace( /\s+/g, '' ); //remove all spaces from the given string

    let isValid = true;
    if( normalizedInput !== null && normalizedInput !== '' ) {
        let unitInParts = normalizedInput.split( ',' );
        let lastValue = -1;
        let i = 0;
        for( i = 0; i < unitInParts.length; i++ ) {
            let units = unitInParts[ i ].split( '-' );

            // if range is given even after UP or SO, lastValue will be NaN
            // pattern like 10-15-20 is invalid
            if( isNaN( lastValue ) ||  units.length > 2 ) {
                isValid = false;
                break;
            }

            if( isNaN( units[ 0 ] ) || units[ 0 ] === '' || Number( units[ 0 ] ) <= lastValue || parseInt( units[ 0 ], 10 ) > _integerMaxValue ) {
                isValid = false;
                break;
            }

            lastValue = Number( units[ 0 ] ); // update last value

            // if there is second part
            if( units.length > 1 ) {
                // check 1st part is number
                if( isNaN( units[ 1 ] ) ) {
                    if( units[ 1 ] !== 'UP' && units[ 1 ] !== 'SO' ) {
                        isValid = false;
                        break;
                    }
                } else if( Number( units[ 1 ] ) <= lastValue || parseInt( units[ 1 ], 10 ) > _integerMaxValue ) {
                    isValid = false;
                    break;
                }

                lastValue = Number( units[ 1 ] );
            }
        }
    }
    data.isValidInput = isValid;
}

let exports;
export default exports = {
    validateUnitsEntered
};

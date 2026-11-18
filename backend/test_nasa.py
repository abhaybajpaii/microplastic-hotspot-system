import os
import truststore

# Make Python use Windows system certificates
truststore.inject_into_ssl()

import earthaccess

# ----------------------------------------
# NASA EARTHDATA LOGIN
# ----------------------------------------

auth = earthaccess.login(
    strategy="interactive",
    persist=True
)

print("NASA Earthdata login successful!")


# ----------------------------------------
# SEARCH CYGNSS MICROPLASTIC DATA
# ----------------------------------------

results = earthaccess.search_data(
    short_name="CYGNSS_L3_MICROPLASTIC_V3.2",
    count=-1
)

print(f"\nTotal datasets found: {len(results)}")


if results:

    # Select the latest dataset returned
    latest_dataset = results[-1]

    print("\nLATEST AVAILABLE DATASET:")
    print(latest_dataset)


    # ----------------------------------------
    # CREATE DATA DIRECTORY
    # ----------------------------------------

    data_folder = "./data"

    if not os.path.exists(data_folder):
        os.makedirs(data_folder)


    # ----------------------------------------
    # DOWNLOAD NASA FILE
    # ----------------------------------------

    print("\nDownloading latest dataset...")

    downloaded_files = earthaccess.download(
        latest_dataset,
        local_path=data_folder
    )

    print("\nDownload complete!")
    print(downloaded_files)


    # ----------------------------------------
    # FIND DOWNLOADED NETCDF FILE
    # ----------------------------------------

    nc_files = [
        file for file in os.listdir(data_folder)
        if file.endswith(".nc")
    ]

    if nc_files:

        # Sort files and use the newest file
        nc_files.sort(
            key=lambda file: os.path.getmtime(
                os.path.join(data_folder, file)
            )
        )

        latest_file = os.path.join(
            data_folder,
            nc_files[-1]
        )

        print("\nDownloaded NetCDF file:")
        print(latest_file)


        # ----------------------------------------
        # READ DATA WITH XARRAY
        # ----------------------------------------

        try:
            import xarray as xr
            import numpy as np
            import pandas as pd

            dataset = xr.open_dataset(latest_file)

            print("\nNASA DATA LOADED SUCCESSFULLY!")

            print("\nAVAILABLE VARIABLES:")
            print(list(dataset.data_vars))

            print("\nCOORDINATES:")
            print(list(dataset.coords))


            # ----------------------------------------
            # EXTRACT MICROPLASTIC DATA
            # ----------------------------------------

            print("\nEXTRACTING MICROPLASTIC DATA...")

            mp_concentration = dataset["mp_concentration"].values
            latitudes = dataset["lat"].values
            longitudes = dataset["lon"].values


            # The dataset has a time dimension.
            # We currently process the latest downloaded time record.
            mp_data = mp_concentration[0]


            # Create a list for valid data points
            processed_data = []

            for lat_index, latitude in enumerate(latitudes):

                for lon_index, longitude in enumerate(longitudes):

                    concentration = mp_data[
                        lat_index,
                        lon_index
                    ]

                    # Skip missing or invalid values
                    if not np.isnan(concentration):

                        processed_data.append({
                            "latitude": float(latitude),
                            "longitude": float(longitude),
                            "mp_concentration": float(
                                concentration
                            )
                        })


            print(
                f"\nVALID DATA POINTS FOUND: "
                f"{len(processed_data)}"
            )


            # ----------------------------------------
            # CREATE DATAFRAME
            # ----------------------------------------

            df = pd.DataFrame(processed_data)

            print("\nFIRST 10 DATA POINTS:")
            print(df.head(10))


            # ----------------------------------------
            # SAVE PROCESSED DATA
            # ----------------------------------------

            output_file = os.path.join(
                data_folder,
                "processed_microplastic_data.csv"
            )

            df.to_csv(
                output_file,
                index=False
            )

            print(
                f"\nDATA SUCCESSFULLY SAVED TO:"
                f"\n{output_file}"
            )


            # ----------------------------------------
            # BASIC DATA STATISTICS
            # ----------------------------------------

            print("\nMICROPLASTIC CONCENTRATION STATISTICS:")

            print(
                df["mp_concentration"].describe()
            )


            # Close the dataset
            dataset.close()


        except ModuleNotFoundError as error:

            print(
                "\nA required Python module is missing."
            )

            print(
                "\nMissing module:",
                error
            )

            print(
                "\nInstall the required packages using:"
            )

            print(
                "\npython -m pip install "
                "xarray netCDF4 numpy pandas"
            )


    else:

        print(
            "\nNo .nc NetCDF file was found."
        )


else:

    print(
        "\nNo NASA datasets found."
    )
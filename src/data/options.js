export const vendors = [
  "Tacoma",
  "Orepac",
  "Boise",
  "Weyerhaeuser",
  "IWP",
  "Disedro",
  "Woodgrain",
  "Rugby",
  "Handy",
  "Amazon",
  "JM Thomas",
  "Basalite",
  "Idaho Fence",
];

export const southVendorRouteOrder = [
  "Tacoma",
  "Boise",
  "Woodgrain",
  "JM Thomas",
  "Orepac",
  "Weyerhaeuser",
  "Handy",
  "Basalite",
  "Idaho Fence",
  "Rugby",
];

export const supplierAddresses = {
  Boise: "4300 S Enterprise St, Boise, ID 83705",
  Weyerhaeuser: "2600 E Amity Rd, Boise, ID 83716",
  Orepac: "5500 S Federal Way, Boise, ID 83716",
  "JM Thomas": "1625 Yamhill Rd, Boise, ID 83716",
  Woodgrain: "1835 W Commerce Ave, Boise, ID 83705",
  "Idaho Fence": "225 N Meridian Rd, Meridian, ID 83642",
  Rugby: "12040 W Executive Dr, Boise, ID 83713",
  Basalite: "1300 E Franklin Rd, Meridian, ID 83642",
  Handy: "700 E King St, Meridian, ID 83642",
};

export const capitalLumberAddress =
  "3105 W State St, Boise, ID 83703";

export const deliveryOriginOptions = [
  {
    name: "Capital Lumber",
    address: capitalLumberAddress,
  },
  ...Object.entries(supplierAddresses).map(([name, address]) => ({
    name,
    address,
  })),
];

export const locations = [
  "Building C - Bay 1 Floor",
  "Building C - Bay 1 Rack",
  "Building C - Bay 2 Floor",
  "Building C - Bay 2 Rack",
  "AF",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "BF",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
  "CF",
  "C1",
  "C2",
  "C3",
  "C4",
  "C5",
  "C6",
  "DF",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "On Street",
  "On Truck/Delivery",
  "Window/door Rack",
  "Order yard",
  "Inner Yard",
  "Outer Yard",
  "Front Counter",
  "Will Call",
  "Pop Room",
  "Undetermined",
];

export const receivingTeamMembers = [
  "Austin",
  "Dane",
  "Isiah",
  "Justin",
  "Pete",
  "Rory",
  "Shane",
  "Tim",
  "Travis",
];

export const favoriteSouthDrivers = [
  "Austin",
  "Nolan",
  "Pete",
];

export const southDrivers = [
  ...favoriteSouthDrivers,
  "Dane",
  "Isiah",
  "Justin",
  "Rory",
  "Shane",
  "Tim",
  "Travis",
];

export const favoriteDeliveryDrivers = favoriteSouthDrivers;

export const deliveryDrivers = southDrivers;

export const deliveryUnloadTypes = [
  "Hand unload",
  "Dump",
  "Forklift",
];

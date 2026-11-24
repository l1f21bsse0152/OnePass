const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const serializeFacilityInfoQr = (facility) => {
  const operatingHours = (facility.operatingHours || [])
    .slice()
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .map(({ dayOfWeek, open, close, closed }) =>
      `${dayNames[dayOfWeek]}: ${closed ? "Closed" : `${open}–${close}`}`
    );
  const details = {
    id: String(facility._id),
    name: facility.name,
    category: facility.category,
    address: facility.address,
    city: facility.city,
    description: facility.description || "",
    amenities: facility.amenities || [],
    operatingHours,
    timeZone: facility.timeZone || "UTC",
    latitude: facility.latitude,
    longitude: facility.longitude
  };
  const location = [details.address, details.city].filter(Boolean).join(", ");
  const payload = [
    "ONEPASS FACILITY",
    `Facility ID: ${details.id}`,
    `Name: ${details.name}`,
    `Category: ${details.category}`,
    `Location: ${location}`,
    details.description ? `About: ${details.description}` : "",
    details.amenities.length ? `Amenities: ${details.amenities.join(", ")}` : "",
    operatingHours.length ? `Operating hours:\n${operatingHours.join("\n")}` : "",
    `Time zone: ${details.timeZone}`,
    Number.isFinite(details.latitude) && Number.isFinite(details.longitude)
      ? `Coordinates: ${details.latitude}, ${details.longitude}`
      : ""
  ].filter(Boolean).join("\n");

  return { facility: details, payload };
};

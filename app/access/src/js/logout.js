$(async () => {
    const rute = await useFetch({ url: "/app/access/ctrl/ctrl-access.php", data: { opc: "logout" } });
    window.location.href = rute;
});

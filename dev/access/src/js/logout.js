$(async () => {
    const rute = await useFetch({ url: "/dev/access/ctrl/ctrl-access.php", data: { opc: "logout" } });
    window.location.href = rute;
});

package com.exemplo.api;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class LojaController {

    record Produto(long id, String nome, String categoria, BigDecimal preco) {}
    record Pedido(long id, long produtoId, int quantidade, String status) {}
    record Usuario(long id, String nome) {}

    private static final List<Produto> PRODUTOS = List.of(
            new Produto(1, "Teclado", "perifericos", new BigDecimal("199.90")),
            new Produto(2, "Mouse", "perifericos", new BigDecimal("89.90")),
            new Produto(3, "Monitor 27\"", "monitores", new BigDecimal("1499.00")),
            new Produto(4, "Headset", "audio", new BigDecimal("349.00")));
    private static final Set<String> CATEGORIAS = Set.of("perifericos", "monitores", "audio");

    private static final List<Pedido> PEDIDOS = List.of(
            new Pedido(1001, 1, 2, "PAGO"),
            new Pedido(1002, 3, 1, "ENVIADO"),
            new Pedido(1003, 2, 5, "PENDENTE"));

    private static final List<Usuario> USUARIOS = List.of(
            new Usuario(1, "Ana"),
            new Usuario(2, "Bruno"),
            new Usuario(3, "Carla"));

    private final Simulador simulador;
    private final boolean consultaOtimizada;

    public LojaController(Simulador simulador,
                          @Value("${app.pedidos.consulta-otimizada}") boolean consultaOtimizada) {
        this.simulador = simulador;
        this.consultaOtimizada = consultaOtimizada;
    }

    @GetMapping("/produtos")
    public List<Produto> produtos(@RequestParam(required = false) String categoria) {
        if (categoria != null && !CATEGORIAS.contains(categoria)) {
            // Erro do cliente: aparece como 4xx no Grafana.
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "categoria inválida");
        }
        return simulador.executar(55, 0, () -> categoria == null
                ? PRODUTOS
                : PRODUTOS.stream().filter(p -> p.categoria().equals(categoria)).toList());
    }

    /**
     * Antes da v1.4.0 a listagem de pedidos fazia uma consulta lenta ao banco.
     * Com PEDIDOS_CONSULTA_OTIMIZADA=false dá para reproduzir a versão antiga.
     */
    @GetMapping("/pedidos")
    public List<Pedido> pedidos() {
        double consultaLentaMs = consultaOtimizada ? 0 : 160;
        return simulador.executar(45, consultaLentaMs, () -> PEDIDOS);
    }

    @GetMapping("/usuarios")
    public List<Usuario> usuarios() {
        return simulador.executar(30, 0, () -> USUARIOS);
    }
}

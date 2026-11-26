package com.exemplo.api;

import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Simula o custo de uma requisição real: tempo de resposta variável, falhas
 * ocasionais e saturação quando a instância recebe mais tráfego do que aguenta.
 *
 * O Micrometer mede tudo isso sozinho (http.server.requests); aqui só
 * produzimos um comportamento parecido com o de uma API de verdade.
 */
@Component
public class Simulador {

    /** Requisições por segundo que uma instância aguenta antes de ficar lenta. */
    private final int capacidadeRps;

    private final AtomicLong segundoAtual = new AtomicLong();
    private final AtomicInteger contagemNoSegundo = new AtomicInteger();
    private volatile int contagemSegundoAnterior;

    public Simulador(@Value("${app.capacidade-rps}") int capacidadeRps) {
        this.capacidadeRps = capacidadeRps;
    }

    /**
     * Executa o trabalho depois de esperar uma latência simulada.
     *
     * @param medianaMs   tempo típico da rota
     * @param consultaMs  custo extra de uma consulta lenta (0 quando não há)
     */
    public <T> T executar(double medianaMs, double consultaMs, Supplier<T> trabalho) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        double carga = cargaAtual() / (double) capacidadeRps;
        double saturacao = Math.max(0, carga - 1);

        // Latência log-normal: a maioria perto da mediana, uma cauda de lentas.
        double ms = medianaMs * Math.exp(0.5 * rnd.nextGaussian());
        if (consultaMs > 0) {
            ms += consultaMs * Math.exp(0.6 * rnd.nextGaussian());
        }
        ms *= 1 + 4 * saturacao;

        dormir((long) ms);

        if (rnd.nextDouble() < 0.06 * Math.min(1, saturacao)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "instância sobrecarregada");
        }
        if (rnd.nextDouble() < 0.002) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "falha simulada");
        }
        return trabalho.get();
    }

    /** Conta as requisições do segundo atual (aproximação simples de req/s). */
    private int cargaAtual() {
        long agora = System.currentTimeMillis() / 1000;
        long anterior = segundoAtual.get();
        if (agora != anterior && segundoAtual.compareAndSet(anterior, agora)) {
            contagemSegundoAnterior = contagemNoSegundo.getAndSet(0);
        }
        int noSegundo = contagemNoSegundo.incrementAndGet();
        return Math.max(contagemSegundoAnterior, noSegundo);
    }

    private static void dormir(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
